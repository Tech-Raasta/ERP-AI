import React from 'react'
import { Link } from 'react-router-dom'

const HorizontalMenuNavLink = ({ path, children }) => {

    return (
        path.includes('https') ?
            <a href={path} target='_blank'><span>{children}</span></a> :
            <Link className="h-full w-full flex items-center" to={path}>
                <span>{children}</span>
            </Link>
    )
}

export default HorizontalMenuNavLink
