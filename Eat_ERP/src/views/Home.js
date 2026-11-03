import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import Loading from 'components/shared/Loading'
import Tooltip from 'components/ui/Tooltip'
import {
    HiChevronRight, HiOutlineBriefcase, HiOutlineCash, HiOutlineCheckCircle, HiOutlineClipboardList, HiOutlineCube,
    HiOutlineLocationMarker, HiOutlineOfficeBuilding, HiOutlineTrendingUp, HiOutlineUserGroup,
} from 'react-icons/hi'
import { navigationConfig } from 'configs/navigation.config'
import { NAV_ITEM_TYPE_ITEM } from 'constants/navigation.constant'
import { apiHome } from 'services/HomeService'
import './Home.css'

// Home: what this user's role can do (old PHP Dashboard). The work waiting in their screens, the business figures
// for roles with the Dashboard section, their production desks, and every screen of their menu one click away.
// Errors are reported by BaseService; the page then shows what it has.

const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
}

const rupees = (value) => `₹${Math.round(value || 0).toLocaleString('en-IN')}`
const count = (value) => (value || 0).toLocaleString('en-IN')

// The production desks, each for the role flag set at login
const DESKS = [
    { flag: 'productionManager', title: 'Production Approver', text: 'Approve batches and allocations.', path: '/production/production-manager' },
    { flag: 'productionFloorManager', title: 'Production Floor Manager', text: 'Run the batches on the floor.', path: '/production/production-floor-manager' },
    { flag: 'storeManager', title: 'Store Manager', text: 'Issue and receive material.', path: '/production/store-manager' },
]

// The role's menu as groups of links: same rule as the menu (a screen shows when its role flag is set)
const menuGroups = (roleDetails) => {
    const allowed = (item) => item.pathName === 'home' || !!roleDetails[item.pathName]
    const leaves = (items) => items.flatMap((item) => {
        if (!allowed(item)) return []
        if (item.type === NAV_ITEM_TYPE_ITEM && item.path) return [{ key: item.key, title: item.title, path: item.path }]
        return leaves(item.subMenu || [])
    })
    const groups = []
    navigationConfig.forEach((top) => {
        if (top.key === 'home' || !allowed(top)) return
        if (top.type === NAV_ITEM_TYPE_ITEM && top.path) {
            groups.push({ key: top.key, title: top.title, links: [{ key: top.key, title: top.title, path: top.path }] })
            return
        }
        const children = (top.subMenu || []).filter(allowed)
        const direct = children.filter((child) => child.type === NAV_ITEM_TYPE_ITEM && child.path)
        if (direct.length) groups.push({ key: `${top.key}.items`, title: top.title, links: leaves(direct) })
        children.filter((child) => !(child.type === NAV_ITEM_TYPE_ITEM && child.path)).forEach((child) => {
            const links = leaves(child.subMenu || [])
            if (links.length) groups.push({ key: child.key, title: `${top.title} · ${child.title}`, links })
        })
    })
    return groups.filter((group) => group.links.length)
}

const Figure = ({ icon, label, value, note, tone, money = true }) => (
    <div className="home-figure">
        <span className={`home-figure-icon ${tone}`}>{icon}</span>
        <div className="min-w-0">
            <p className="text-xs text-gray-500">{label}</p>
            <p className={`text-lg font-bold ${value < 0 ? 'text-red-600' : 'text-gray-800 dark:text-gray-100'}`}>{money ? rupees(value) : count(value)}</p>
            {note ? <p className="text-xs text-gray-400 truncate">{note}</p> : null}
        </div>
    </div>
)

const Home = () => {
    const user = useSelector((state) => state.auth.user)
    const roleDetails = useMemo(() => user.roleDetails || {}, [user.roleDetails])
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        apiHome()
            .then((res) => setData(res.data))
            .catch(() => setData(null))
            .finally(() => setLoading(false))
    }, [])

    const groups = useMemo(() => menuGroups(roleDetails), [roleDetails])
    const desks = DESKS.filter((desk) => roleDetails[desk.flag] === 1)
    const work = data ? data.work : []
    const waiting = work.reduce((sum, module) => sum + module.items.reduce((total, item) => total + item.count, 0), 0)
    const figures = data && data.figures
    const profile = data ? data.user : null
    const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

    return (
        <Loading loading={loading}>
            <div className="container mx-auto px-4 sm:px-4 lg:px-6 py-4">

                <div className="home-hero mb-6">
                    <div>
                        <p className="text-sm text-gray-500">{today}</p>
                        <h3 className="mb-1">{greeting()}{profile && profile.name ? `, ${profile.name}` : user.userName ? `, ${user.userName}` : ''}</h3>
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                            {profile && profile.role ? <span className="home-pill"><HiOutlineBriefcase /> {profile.role}</span> : null}
                            {profile && profile.depots.length ? (
                                <Tooltip title={profile.depots.join(', ')}>
                                    <span className="home-pill"><HiOutlineLocationMarker /> {profile.depots.length === 1 ? profile.depots[0] : `${profile.depots.length} depots`}</span>
                                </Tooltip>
                            ) : null}
                        </div>
                    </div>
                    {data ? (
                        <div className="home-waiting">
                            <p className="text-3xl font-bold">{count(waiting)}</p>
                            <p className="text-sm">{waiting === 1 ? 'entry waits for you' : 'entries wait for you'}</p>
                        </div>
                    ) : null}
                </div>

                {figures ? (
                    <section className="mb-6">
                        <h5 className="mb-3">Business at a glance</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                            <Figure icon={<HiOutlineTrendingUp />} tone="home-tone-sales" label="Sales this month" value={figures.monthSales} note="Net of sales returns" />
                            <Figure icon={<HiOutlineCash />} tone="home-tone-year" label="Sales this financial year" value={figures.yearSales} note={`Since ${figures.fyStart.split('-').reverse().join('/')}, net of returns`} />
                            <Figure icon={<HiOutlineOfficeBuilding />} tone="home-tone-due" label="Receivable" value={figures.receivable} note="All distributors, after payments and notes" />
                            <Figure
                                icon={<HiOutlineUserGroup />}
                                tone="home-tone-people"
                                label="Distributors"
                                money={false}
                                value={figures.distributors.total}
                                note={`GT ${count(figures.distributors.generalTrade)} · MT ${count(figures.distributors.modernTrade)} · E-com ${count(figures.distributors.eCommerce)}`}
                            />
                        </div>
                    </section>
                ) : null}

                {data ? (
                    <section className="mb-6">
                        <h5 className="mb-3">Waiting for you</h5>
                        {work.length && waiting ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {work.map((module) => (
                                    <div key={module.section} className="home-card">
                                        <div className="flex items-center justify-between mb-2">
                                            <Link to={module.path} className="font-semibold text-gray-800 dark:text-gray-100 hover:text-amber-600">{module.label}</Link>
                                            <span className="text-xs text-gray-400">{module.group}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            {module.items.map((item) => (
                                                <Link key={item.key} to={`${module.path}?status=${item.key}`} className={`home-work-row ${item.count ? '' : 'home-work-row-done'}`}>
                                                    <span>{item.label}</span>
                                                    <span className="flex items-center gap-1">
                                                        <span className={item.count ? 'home-count' : 'home-count-zero'}>{count(item.count)}</span>
                                                        <HiChevronRight className="text-gray-400" />
                                                    </span>
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="home-card flex items-center gap-3 text-gray-500">
                                <HiOutlineCheckCircle className="text-2xl text-emerald-500" />
                                Nothing is waiting for you right now.
                            </div>
                        )}
                    </section>
                ) : null}

                {desks.length ? (
                    <section className="mb-6">
                        <h5 className="mb-3">Production desks</h5>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {desks.map((desk) => (
                                <Link key={desk.flag} to={desk.path} className="home-card home-link-card">
                                    <span className="home-figure-icon home-tone-people"><HiOutlineCube /></span>
                                    <span className="flex-1">
                                        <span className="block font-semibold text-gray-800 dark:text-gray-100">{desk.title}</span>
                                        <span className="block text-xs text-gray-500">{desk.text}</span>
                                    </span>
                                    <HiChevronRight className="text-gray-400" />
                                </Link>
                            ))}
                        </div>
                    </section>
                ) : null}

                <section className="mb-2">
                    <h5 className="mb-3">Your screens</h5>
                    {groups.length ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                            {groups.map((group) => (
                                <div key={group.key} className="home-card">
                                    <p className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-100 mb-2"><HiOutlineClipboardList className="text-amber-600" /> {group.title}</p>
                                    <div className="flex flex-col">
                                        {group.links.map((link) => (
                                            <Link key={link.key} to={link.path} className="home-link">{link.title}</Link>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="home-card text-gray-500">Your role has no screens yet. Ask your administrator for access.</div>
                    )}
                </section>
            </div>
        </Loading>
    )
}

export default Home
