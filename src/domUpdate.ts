interface TextElement {
  textContent: string | null
}

interface HtmlElement {
  innerHTML: string
}

interface StyledElement {
  style: {
    getPropertyValue?: (name: string) => string
    setProperty?: (name: string, value: string) => void
  }
}

export function setElementText(element: TextElement, text: string) {
  if (element.textContent === text) return false
  element.textContent = text
  return true
}

export function setElementHtml(element: HtmlElement, html: string) {
  if (element.innerHTML === html) return false
  element.innerHTML = html
  return true
}

export function setElementStyle(element: StyledElement, name: string, value: string) {
  const style = element.style as StyledElement['style'] & Record<string, unknown>
  const current = typeof style.getPropertyValue === 'function'
    ? style.getPropertyValue(name)
    : style[name]
  if (current === value) return false
  if (typeof style.setProperty === 'function') style.setProperty(name, value)
  else style[name] = value
  return true
}
