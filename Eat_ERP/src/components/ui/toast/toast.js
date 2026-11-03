import ToastWrapper, { toastDefaultProps } from './ToastWrapper'

const defaultWrapperId = 'default'
const wrappers = new Map()

function castPlacment(placement) {
    if (/\top\b/.test(placement)) {
        return 'top-full'
    }

    if (/\bottom\b/.test(placement)) {
        return 'bottom-full'
    }
}

async function createWrapper(wrapperId, props) {
    const [wrapper] = await ToastWrapper.getInstance(props)

    wrappers.set(wrapperId || defaultWrapperId, wrapper)

    return wrapper
}

function getWrapper(wrapperId) {
    if (wrappers.size === 0) {
        return null
    }
    return wrappers.get(wrapperId || defaultWrapperId)
}

const toast = (message) => toast.push(message)

const REPEAT_MS = 3000
const recent = new Map()
const textOf = (node) => {
    if (node === null || node === undefined || typeof node === 'boolean') return ''
    if (typeof node === 'string' || typeof node === 'number') return String(node)
    if (Array.isArray(node)) return node.map(textOf).join('')
    if (node.props) return textOf(node.props.children)
    return ''
}
const isRepeat = (message) => {
    const key = textOf(message)
    if (!key) return false
    const now = Date.now()
    recent.forEach((time, item) => {
        if (now - time > REPEAT_MS) recent.delete(item)
    })
    if (recent.has(key)) return true
    recent.set(key, now)
    return false
}

toast.push = (message, options = toastDefaultProps) => {
    if (isRepeat(message)) return Promise.resolve(null)

    let id = options.placement
    if (options.block) {
        id = castPlacment(options.placement)
    }

    let wrapper = getWrapper(id)

    if (wrapper?.current) {
        return wrapper.current.push(message)
    }

    return createWrapper(id ?? '', options).then((ref) => {
        return ref.current?.push(message)
    })
}

toast.remove = (key) => {
    wrappers.forEach((elm) => elm.current.remove(key))
}

toast.removeAll = () => {
    wrappers.forEach((elm) => elm.current.removeAll())
}

export default toast
