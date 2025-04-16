import { FeatherIcon } from '../FeatherIcon/FeatherIcon.jsx';
import './Card.css';

export const Card = ({ 
  title, 
  icon, 
  children, 
  className = '', 
  actions = null,
  onOptionsClick = null
}) => {
  return (
    <div className={`card ${className}`}>
      <div className="card__header">
        <div className="card__title">
          {icon && <FeatherIcon icon={icon} size={{ width: 16, height: 16 }} />}
          {title}
        </div>
        <div className="card__actions">
          {actions}
          {onOptionsClick && (
            <button 
              className="icon-button" 
              title="Options"
              onClick={onOptionsClick}
            >
              <FeatherIcon icon="more-vertical" size={{ width: 16, height: 16 }} />
            </button>
          )}
        </div>
      </div>
      <div className="card__content">
        {children}
      </div>
    </div>
  );
};