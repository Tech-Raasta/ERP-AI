import React from 'react'
import { Link } from 'react-router-dom'
import { HiArrowNarrowLeft } from 'react-icons/hi'

// A whole-page message in place of a screen: no access, page not found, or a screen that failed to open
const StatusPage = ({ icon, title, message, linkTo = '/home', linkLabel = 'Back to Home', action }) => (
    <div className="card card-border card-shadow">
        <div className="flex flex-col items-center text-center py-12 px-4">
            {icon ? (
                <span className="flex items-center justify-center w-11 h-11 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200 text-2xl mb-4">{icon}</span>
            ) : null}
            <h4 className="mb-1">{title}</h4>
            {message ? <p className="text-gray-500 mb-4 max-w-md">{message}</p> : null}
            <div className="flex items-center gap-4">
                {action}
                {linkTo ? (
                    <Link to={linkTo} className="text-sm text-amber-600 inline-flex items-center gap-1"><HiArrowNarrowLeft /> {linkLabel}</Link>
                ) : null}
            </div>
        </div>
    </div>
)

export default StatusPage
