import { NAV_ITEM_TYPE_ITEM } from 'constants/navigation.constant'

// Which menu entries and pages a role may see. roleDetails comes from login (models/user.js getUserRoleDetails): one
// flag per role section. Every menu (top, side, mobile, favourites) and the routes use this same rule, so nothing the
// role cannot open is offered anywhere.

export const canOpen = (item, roleDetails = {}) => item.pathName === 'home' || !!roleDetails[item.pathName]

// The menu tree with only what the role may open. A group stays when at least one of its entries does; an empty group
// is dropped.
export const filterNav = (items, roleDetails = {}) => items.flatMap((item) => {
    const children = item.subMenu || []
    if (children.length) {
        const kept = filterNav(children, roleDetails)
        return kept.length ? [{ ...item, subMenu: kept }] : []
    }
    if (item.type === NAV_ITEM_TYPE_ITEM && item.path) return canOpen(item, roleDetails) ? [item] : []
    return []
})
