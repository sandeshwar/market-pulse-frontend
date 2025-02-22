export function createElementFromHTML(htmlString) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = htmlString;
  return wrapper.firstElementChild;
}