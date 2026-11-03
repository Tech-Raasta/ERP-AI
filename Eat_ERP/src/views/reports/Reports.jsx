import React, { useEffect, useMemo, useState } from 'react'
import Input from 'components/ui/Input'
import Loading from 'components/shared/Loading'
import { Link } from 'react-router-dom'
import {
    HiChevronRight, HiOutlineCalculator, HiOutlineClock, HiOutlineCog, HiOutlineCube, HiOutlineDocumentReport, HiOutlineShoppingCart, HiSearch,
} from 'react-icons/hi'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import { apiReportCatalog } from 'services/reportsService'
import './Reports.css'

// The reports this role can see, from the server (old PHP view_reports.php). Each opens in the Report Viewer. The
// Production report keeps its own screen, shown only when the server lists it for this role.

const OWN_SCREENS = [
    { key: 'production', group: 'Production', name: 'Production', description: 'Materials used and made by each batch.', path: '/reports/production-report' },
]

const GROUP_LOOK = {
    Sales: { icon: <HiOutlineShoppingCart />, tone: 'report-tone-sales' },
    Accounting: { icon: <HiOutlineCalculator />, tone: 'report-tone-accounting' },
    Stock: { icon: <HiOutlineCube />, tone: 'report-tone-stock' },
    Production: { icon: <HiOutlineCog />, tone: 'report-tone-production' },
}
const OTHER_LOOK = { icon: <HiOutlineDocumentReport />, tone: 'report-tone-other' }
const lookOf = (group) => GROUP_LOOK[group] || OTHER_LOOK

// The last few reports opened on this browser. A convenience only: the page works the same without it.
const RECENT_KEY = 'reports.recent'
const RECENT_COUNT = 4
const readRecent = () => {
    try {
        return JSON.parse(localStorage.getItem(RECENT_KEY)) || []
    } catch (e) {
        return []
    }
}
const remember = (path) => {
    try {
        localStorage.setItem(RECENT_KEY, JSON.stringify([path, ...readRecent().filter((item) => item !== path)].slice(0, RECENT_COUNT)))
    } catch (e) {
        // Nothing to do: the list simply stays as it was
    }
}

const ReportTile = ({ report }) => {
    const { icon, tone } = lookOf(report.group)
    return (
        <Link to={report.path} className="report-tile" onClick={() => remember(report.path)}>
            <span className={`report-icon ${tone}`}>{icon}</span>
            <span className="min-w-0 flex-1">
                <span className="block font-semibold text-gray-800 dark:text-gray-100">{report.name}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">{report.description}</span>
            </span>
            <HiChevronRight className="report-tile-arrow" />
        </Link>
    )
}

const Reports = () => {
    const [groups, setGroups] = useState([])
    const [screens, setScreens] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [groupName, setGroupName] = useState('')

    useEffect(() => {
        apiReportCatalog()
            .then((res) => {
                setGroups(res.data['groups'] || [])
                setScreens(res.data['screens'] || [])
            })
            .catch((error) => {
                toast.push(
                    <Notification title="Error" type="danger" closable>
                        {error && error.response ? error.response.data['message'] : 'Fetching reports failed'}
                    </Notification>
                )
            })
            .finally(() => setLoading(false))
    }, [])

    const catalog = useMemo(() => {
        const own = OWN_SCREENS.filter((screen) => screens.includes(screen.key))
        // A group can hold only an own screen, when no viewer report of it is allowed
        const names = [...new Set([...groups.map(({ group }) => group), ...own.map((screen) => screen.group)])]
        return names.map((group) => {
            const found = groups.find((item) => item.group === group)
            return {
                group,
                links: [
                    ...own.filter((report) => report.group === group),
                    ...(found ? found.reports : []).map((report) => ({ ...report, path: `/reports/view/${report.key}` })),
                ].map((report) => ({ ...report, group })),
            }
        })
    }, [groups, screens])

    const term = search.trim().toLowerCase()
    const matches = (report) => !term || `${report.name} ${report.description} ${report.group}`.toLowerCase().includes(term)
    const shown = catalog
        .filter(({ group }) => !groupName || group === groupName)
        .map(({ group, links }) => ({ group, links: links.filter(matches) }))
        .filter(({ links }) => links.length)

    const allLinks = catalog.flatMap(({ links }) => links)
    const recent = term || groupName ? [] : readRecent().map((path) => allLinks.find((report) => report.path === path)).filter(Boolean)

    const groupButton = (name, label, count) => (
        <button
            key={label}
            type="button"
            className={`report-chip ${groupName === name ? 'report-chip-active' : ''}`}
            onClick={() => setGroupName(name)}
        >
            {label}<span className="report-chip-count">{count}</span>
        </button>
    )

    return (
        <Loading loading={loading}>
            <div className="container mx-auto px-4 sm:px-4 lg:px-6 py-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
                    <div>
                        <h3 className="mb-0">Reports</h3>
                        <p className="text-gray-500">{allLinks.length} reports available to you</p>
                    </div>
                    <Input
                        size="sm"
                        className="lg:w-72"
                        placeholder="Search reports"
                        prefix={<HiSearch className="text-lg" />}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex flex-wrap gap-2 mb-6">
                    {groupButton('', 'All', allLinks.length)}
                    {catalog.map(({ group, links }) => groupButton(group, group, links.length))}
                </div>

                {recent.length ? (
                    <section className="mb-6">
                        <h6 className="report-heading"><HiOutlineClock className="text-lg" /> Recently opened</h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                            {recent.map((report) => <ReportTile key={report.path} report={report} />)}
                        </div>
                    </section>
                ) : null}

                {!loading && !shown.length ? <p className="py-10 text-center text-gray-500">No reports found.</p> : null}

                {shown.map(({ group, links }) => (
                    <section key={group} className="mb-6">
                        <h6 className="report-heading">{lookOf(group).icon} {group}</h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                            {links.map((report) => <ReportTile key={report.path} report={report} />)}
                        </div>
                    </section>
                ))}
            </div>
        </Loading>
    )
}

export default Reports
