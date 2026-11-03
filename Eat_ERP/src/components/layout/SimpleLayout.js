import React, { useEffect, useState } from 'react'
import Header from 'components/template/Header'
import SidePanel from 'components/template/SidePanel'
import UserDropdown from 'components/template/UserDropdown'
import HeaderLogo from 'components/template/HeaderLogo'
import MobileNav from 'components/template/MobileNav'
import HorizontalNav from 'components/template/HorizontalNav'
import View from 'views'
import { useSelector } from 'react-redux'
import { Dialog } from 'components/ui'
import ResetPassForm from 'components/shared/ResetPassForm'

const HeaderActionsStart = () => {
    return (
        <>
            <HeaderLogo />
            <MobileNav />
        </>
    )
}

const HeaderActionsEnd = () => {
    return (
        <>
            {/* <SidePanel /> */}
            <UserDropdown hoverable={false} />
        </>
    )
}

const SimpleLayout = () => {

    const checkExpiry = useSelector((state) => state.auth.session);

    
    const [open, setOpen] = useState(false);
    

    const handleData = (childData) => {
        setOpen(childData);
    };

    useEffect(() => {
        setOpen(checkExpiry.expired);
    }, [checkExpiry.expired]);

    return (
        <div className="app-layout-simple flex flex-auto flex-col min-h-screen">
            <div className="flex flex-auto min-w-0">
                <div className="flex flex-col flex-auto min-h-screen min-w-0 relative w-full">
                    <Header
                        container
                        className="shadow dark:shadow-2xl"
                        headerStart={<HeaderActionsStart />}
                        headerMiddle={<HorizontalNav />}
                        headerEnd={<HeaderActionsEnd />}
                    />
                    <View pageContainerType="contained" />
                </div>
            </div>
            <Dialog isOpen={open} closable={false} height={400} onClose={()=>setOpen(false)}>
                <ResetPassForm data={checkExpiry.data} onCheckDialog={handleData} />
            </Dialog>
        </div>
    )
}

export default SimpleLayout
