import React from 'react'
import { HiOutlineExclamation } from 'react-icons/hi'
import Button from 'components/ui/Buttons'
import StatusPage from 'components/shared/StatusPage'

// A screen that crashes while drawing shows this instead of a blank page; the rest of the ERP keeps working.
// The route key resets it, so moving to another page tries again.
class PageErrorBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = { failed: false }
    }

    static getDerivedStateFromError() {
        return { failed: true }
    }

    componentDidCatch(error, info) {
        // Kept in the console for whoever fixes it
        console.error('Page failed to open', error, info && info.componentStack)
    }

    render() {
        if (!this.state.failed) return this.props.children
        return (
            <StatusPage
                icon={<HiOutlineExclamation />}
                title="This page could not be opened"
                message="Something went wrong while showing this page. Reload to try again; if it keeps happening, tell the ERP team which page and what you did."
                action={<Button size="sm" variant="solid" onClick={() => window.location.reload()}>Reload</Button>}
            />
        )
    }
}

export default PageErrorBoundary
