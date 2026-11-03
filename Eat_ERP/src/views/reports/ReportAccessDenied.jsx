import React from 'react'
import { HiOutlineLockClosed } from 'react-icons/hi'
import StatusPage from 'components/shared/StatusPage'

// Shown instead of a report page the user's role may not open, or one that does not exist
const ReportAccessDenied = ({ message }) => (
    <StatusPage
        icon={<HiOutlineLockClosed />}
        title="No access"
        message={message || 'You do not have access to this report.'}
        linkTo="/reports"
        linkLabel="Back to Reports"
    />
)

export default ReportAccessDenied
