# diffusion_llm_trainer_colab.py

# import os
import torch
import logging
import math
from dataclasses import dataclass, field
# from typing import Optional
import platform

from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    HfArgumentParser,
    TrainingArguments,
    Trainer,
    set_seed,
    DataCollatorForLanguageModeling,
)
from datasets import load_dataset
# import accelerate
from tqdm.auto import tqdm


# Configure logging
logging.basicConfig(
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

@dataclass
class ModelArguments:
    model_name_or_path: str = field(
        default="facebook/opt-350m",  # Smaller model for Colab
        metadata={"help": "Path to pretrained model or model identifier"}
    )
    use_flash_attention: bool = field(
        default=True,  # Disabled by default for compatibility (enabled by Sandy)
        metadata={"help": "Whether to use flash attention"}
    )

@dataclass
class DataArguments:
    dataset_name: str = field(
        default="KodCode/KodCode-V1-SFT-R1",
        metadata={"help": "Dataset name"}
    )
    max_seq_length: int = field(
        default=512,  # Reduced for Colab
        metadata={"help": "Maximum sequence length"}
    )
    subset_size: int = field(
        default=1000,  # Small subset for Colab
        metadata={"help": "Number of examples to use"}
    )

@dataclass
class DiffusionArguments:
    num_diffusion_steps: int = field(
        default=100,  # Reduced steps for faster training
        metadata={"help": "Number of diffusion steps"}
    )
    noise_schedule: str = field(
        default="cosine",
        metadata={"help": "Noise schedule type"}
    )

def create_diffusion_schedule(num_steps):
    """Create cosine diffusion schedule"""
    logger.info(f"Creating diffusion schedule with {num_steps} steps")
    steps = num_steps + 1
    s = 0.008
    x = torch.linspace(0, 1, steps)

    # Use tqdm to show progress during schedule creation
    progress_bar = tqdm(total=4, desc="Creating diffusion schedule")

    alphas_cumprod = torch.cos(((x + s) / (1 + s)) * math.pi * 0.5) ** 2
    progress_bar.update(1)

    alphas_cumprod = alphas_cumprod / alphas_cumprod[0]
    progress_bar.update(1)

    betas = 1 - (alphas_cumprod[1:] / alphas_cumprod[:-1])
    progress_bar.update(1)

    betas = torch.clip(betas, 0, 0.999)
    progress_bar.update(1)

    progress_bar.close()

    # Ensure all tensors are contiguous for better performance when moving to device later
    betas = betas.contiguous()
    alphas = (1.0 - betas).contiguous()
    alphas_cumprod = alphas_cumprod.contiguous()

    logger.info("Diffusion schedule created successfully")

    return {
        'betas': betas,
        'alphas': alphas,
        'alphas_cumprod': alphas_cumprod,
    }

class DiffusionLLMTrainer(Trainer):
    def __init__(self, diffusion_params, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.diffusion_params = diffusion_params
        self.progress_bar = None
        self.current_epoch = 0
        self.total_steps = 0
        self.completed_steps = 0

    def compute_loss(self, model, inputs, return_outputs=False, num_items_in_batch=None):
        # Get embeddings
        outputs = model(**inputs, output_hidden_states=True)
        x_start = outputs.hidden_states[-1].detach()

        # Add noise
        batch_size = x_start.shape[0]
        device = x_start.device

        # Move diffusion parameters to the same device as the model
        if not hasattr(self, 'diffusion_params_device') or self.diffusion_params_device != device:
            self.diffusion_params_device = device
            self.diffusion_params = {
                k: v.to(device) if isinstance(v, torch.Tensor) else v
                for k, v in self.diffusion_params.items()
            }
            logger.info(f"Moved diffusion parameters to device: {device}")

        t = torch.randint(0, len(self.diffusion_params['betas']), (batch_size,), device=device)
        noise = torch.randn_like(x_start)

        # Diffusion process
        alphas_cumprod = self.diffusion_params['alphas_cumprod'][t].view(-1, 1, 1)
        x_noisy = torch.sqrt(alphas_cumprod) * x_start + torch.sqrt(1 - alphas_cumprod) * noise

        # Predict noise
        inputs['inputs_embeds'] = x_noisy
        inputs.pop('input_ids', None)
        noise_pred_outputs = model(**inputs, output_hidden_states=True)

        # Use hidden states instead of logits for noise prediction
        # This ensures shape compatibility with the original noise tensor
        noise_pred = noise_pred_outputs.hidden_states[-1]

        # Loss calculation
        loss = torch.nn.functional.mse_loss(noise_pred, noise)

        return (loss, outputs) if return_outputs else loss

    def train(self, resume_from_checkpoint=None, trial=None, **kwargs):
        """Override train method to add progress tracking"""
        # Calculate total steps for progress bar
        args = self.args
        num_update_steps_per_epoch = max(1, self.args.gradient_accumulation_steps)
        if args.per_device_train_batch_size > 0:
            num_update_steps_per_epoch = max(num_update_steps_per_epoch,
                                            len(self.train_dataset) //
                                            (args.per_device_train_batch_size * args.gradient_accumulation_steps))

        self.total_steps = num_update_steps_per_epoch * args.num_train_epochs
        self.completed_steps = 0

        logger.info(f"Starting training for {args.num_train_epochs} epochs ({self.total_steps} steps)")
        self.progress_bar = tqdm(total=self.total_steps, desc=f"Training")

        # Call parent's train method
        result = super().train(resume_from_checkpoint, trial, **kwargs)

        # Close progress bar
        if self.progress_bar is not None:
            self.progress_bar.close()
            self.progress_bar = None

        return result

    def _maybe_log_save_evaluate(self, *args, **kwargs):
        """Override to update progress bar"""
        # Extract the parameters we need from args
        tr_loss = args[0] if len(args) > 0 else None
        epoch = args[3] if len(args) > 3 else None

        # Call the parent method with all arguments
        result = super()._maybe_log_save_evaluate(*args, **kwargs)

        # Update progress bar
        if self.progress_bar is not None:
            # Calculate steps completed in this epoch
            if epoch is not None and epoch != self.current_epoch:
                steps_in_epoch = self.args.eval_steps if self.args.evaluation_strategy == "steps" else 1
                steps_completed = steps_in_epoch
                self.current_epoch = epoch
            else:
                steps_completed = 1

            self.completed_steps += steps_completed
            self.progress_bar.update(steps_completed)

            # Update description with loss
            if tr_loss is not None:
                current_loss = tr_loss.item() if hasattr(tr_loss, "item") else tr_loss
                self.progress_bar.set_description(f"Training [Loss: {current_loss:.4f}]")

        return result

def main():
    # Parse arguments
    parser = HfArgumentParser((ModelArguments, DataArguments, DiffusionArguments, TrainingArguments))
    model_args, data_args, diffusion_args, training_args = parser.parse_args_into_dataclasses()

    # Check if running on Mac M1/M2 with MPS
    is_mps_available = torch.backends.mps.is_available()
    if is_mps_available and training_args.fp16:
        logger.warning("fp16 is enabled but running on MPS device. This may cause issues.")
        logger.warning("Consider setting fp16=False when running on Mac M1/M2.")

    # Set seed
    set_seed(training_args.seed)

    # Load tokenizer and model with progress tracking
    logger.info(f"Loading tokenizer and model from {model_args.model_name_or_path}")

    # Create progress bar for model loading process
    loading_progress = tqdm(total=2, desc="Loading model components")

    # Load tokenizer
    tokenizer = AutoTokenizer.from_pretrained(model_args.model_name_or_path)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    loading_progress.update(1)

    # Load model
    # Check if running on Mac M1/M2 with MPS
    is_mps_available = torch.backends.mps.is_available()
    is_mac_silicon = platform.processor() == 'arm' and platform.system() == 'Darwin'

    # Set appropriate device and dtype
    if is_mps_available and is_mac_silicon:
        logger.info("Running on Mac with Apple Silicon (M1/M2). Using MPS device.")
        device = torch.device("mps")
        torch_dtype = torch.float32  # Use float32 on MPS for better compatibility
    else:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        torch_dtype = torch.float16

    try:
        # First try loading with 8-bit quantization (not on MPS)
        if not is_mps_available:
            logger.info("Attempting to load model with 8-bit quantization...")
            model = AutoModelForCausalLM.from_pretrained(
                model_args.model_name_or_path,
                torch_dtype=torch_dtype,
                load_in_8bit=True,  # Use 8-bit quantization for memory efficiency
            )
        else:
            # On MPS, skip 8-bit quantization attempt
            raise ImportError("Skipping 8-bit quantization on MPS device")
    except ImportError as e:
        # If bitsandbytes is not properly installed or on MPS, fall back to regular loading
        if is_mps_available:
            logger.info("Loading model for Mac M1/M2 with MPS device")
        else:
            logger.warning(f"8-bit quantization failed: {e}")
            logger.info("Falling back to standard model loading without quantization")

        model = AutoModelForCausalLM.from_pretrained(
            model_args.model_name_or_path,
            torch_dtype=torch_dtype,
        )

    # Explicitly move model to the correct device
    model = model.to(device)
    logger.info(f"Model moved to device: {device}")

    loading_progress.update(1)
    loading_progress.close()

    # Load dataset with progress tracking
    logger.info(f"Loading dataset {data_args.dataset_name}")
    dataset_progress = tqdm(total=2, desc="Dataset preparation")

    # Load dataset
    dataset = load_dataset(data_args.dataset_name, split="train")
    dataset_progress.update(1)

    # Take subset
    logger.info(f"Taking subset of {min(data_args.subset_size, len(dataset))} examples from {len(dataset)} total")
    dataset = dataset.shuffle(seed=42).select(range(min(data_args.subset_size, len(dataset))))
    dataset_progress.update(1)
    dataset_progress.close()

    # Tokenize dataset
    logger.info(f"Tokenizing dataset with {len(dataset)} examples")

    # Print dataset columns to debug
    logger.info(f"Dataset columns: {dataset.column_names}")

    # Prepare text for tokenization by combining question and solution
    def tokenize_function(examples):
        # Combine question and solution to create training text
        texts = []
        for i in range(len(examples["question"])):
            # Format as instruction-response pair
            if "style" in examples and examples["style"][i] == "Instruct":
                # For instruct style, format as question-answer
                text = f"Question: {examples['question'][i]}\n\nSolution: {examples['solution'][i]}"
            else:
                # For complete style or default, include test_info if available
                test_info = examples.get("test_info", [None] * len(examples["question"]))[i] or ""
                text = f"{test_info}\n\nQuestion: {examples['question'][i]}\n\nSolution: {examples['solution'][i]}"

            texts.append(text)

        return tokenizer(
            texts,
            truncation=True,
            max_length=data_args.max_seq_length,
            padding="max_length",
        )

    tokenized_dataset = dataset.map(
        tokenize_function,
        batched=True,
        remove_columns=dataset.column_names,
        desc="Tokenizing dataset",  # This adds a tqdm progress bar
    )

    # Create data collator
    data_collator = DataCollatorForLanguageModeling(
        tokenizer=tokenizer,
        mlm=False,
    )

    # Create diffusion schedule
    diffusion_params = create_diffusion_schedule(diffusion_args.num_diffusion_steps)

    # Initialize trainer
    trainer = DiffusionLLMTrainer(
        diffusion_params=diffusion_params,
        model=model,
        args=training_args,
        train_dataset=tokenized_dataset,
        data_collator=data_collator,
    )

    # Train
    trainer.train()

    # Save model with progress tracking
    logger.info("Training complete, saving model...")
    save_progress = tqdm(total=1, desc="Saving model")
    trainer.save_model()
    save_progress.update(1)
    save_progress.close()
    logger.info("Model saved successfully")

if __name__ == "__main__":
    # Check if running on Mac M1/M2 with MPS
    is_mps_available = torch.backends.mps.is_available()

    # Set up training arguments
    training_args = TrainingArguments(
        output_dir="./results",
        num_train_epochs=3,
        per_device_train_batch_size=4,  # Reduced for Colab
        gradient_accumulation_steps=4,
        learning_rate=5e-5,
        warmup_ratio=0.1,
        logging_steps=10,
        save_steps=100,
        fp16=not is_mps_available,  # Disable fp16 on MPS (Mac M1/M2)
        report_to="tensorboard",
        save_total_limit=2,
    )

    if is_mps_available:
        logger.info("Running on MPS (Mac M1/M2). Disabled fp16 mixed precision.")

    # Run training
    main()