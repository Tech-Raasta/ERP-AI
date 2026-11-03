import React, { useEffect, useState } from 'react'
import { navigationConfig, seletedNavConfig, otherNavConfig } from 'configs/navigation.config'
import { filterNav } from 'utils/navAccess'
import { Dropdown } from 'components/ui'
import { AuthorityCheck } from 'components/shared'
import HorizontalMenuItem from './HorizontalMenuItem'
import HorizontalMenuDropdownItem from './HorizontalMenuDropdownItem'
import {
    NAV_ITEM_TYPE_TITLE,
    NAV_ITEM_TYPE_COLLAPSE,
    NAV_ITEM_TYPE_ITEM,
} from 'constants/navigation.constant'
import { useTranslation } from 'react-i18next'
import deepParseJson from 'utils/deepParseJson'
import { useSelector } from 'react-redux'
// import { Link } from 'react-router-dom'

const HorizontalMenuContent = ({ manuVariant, userAuthority = [] }) => {
    const { t } = useTranslation()
    let roleDetails = {
        home: 0,
        master: 0,
        product: 0,
        category: 0,
        vendor: 0,
        depot: 0,
        box: 0,
        cityMaster: 0,
        rawMaterial: 0,
        packagingMaterial: 0,
        transaction: 0,
        purchaseOrder: 0,
        goodsReceivedNote: 0,
        invoiceProcessing: 0,
        financeVoucher: 0,
        vendorPayment: 0,
        salesOut: 0,
        endOfMonthSales: 0,
        batchProcessing: 0,
        sales: 1,
        salesUpload: 1,
        salesReturnUpload: 1,
        paymentDetails: 1,
        creditDebitNote: 1,
        oldPaymentUpload: 1,
        userMaster: 1,
        attendance: 1,
        userRoles: 1,
        productionDashboard: 0,
        productionManager: 0,
        productionFloorManager: 0,
        storeManager: 0
    }

    const userInfo = useSelector((state) => state.auth.user)
    // console.log(roleDetails)
    roleDetails = userInfo.roleDetails ? userInfo.roleDetails : roleDetails

    // Items inside a menu group (e.g. Master -> Product) are shown only for roles that can open them
    const canSeeNav = (nav) => nav.pathName === 'home' || !!roleDetails[nav.pathName]

    const newMenu = useSelector(state => state.auth.selectedMenu)
    // console.log(newMenu)

    return (
        <>
            <span className={`flex items-center ${newMenu.personalized ? 'hidden' : 'visible'}`} >
                {filterNav(navigationConfig, roleDetails).map((nav) => {
                    for (let name in roleDetails) {
                        if (roleDetails[name]) {
                            if (nav.pathName == name || nav.pathName === 'home') {
                                if (
                                    nav.type === NAV_ITEM_TYPE_TITLE ||
                                    nav.type === NAV_ITEM_TYPE_COLLAPSE
                                ) {
                                    return (
                                        <AuthorityCheck
                                            authority={nav.authority}
                                            userAuthority={userAuthority}
                                            key={nav.key}
                                        >
                                            <Dropdown
                                                trigger="hover"
                                                renderTitle={
                                                    <HorizontalMenuItem
                                                        manuVariant={manuVariant}
                                                        nav={nav}
                                                        key={nav.key}
                                                    />
                                                }
                                            >
                                                {
                                                    nav.subMenu.map((secondarySubNav) => {
                                                        // A group with nothing this role can open is not shown
                                                        if (secondarySubNav.subMenu.length > 0 && !secondarySubNav.subMenu.some(canSeeNav)) return null
                                                        for (let name in roleDetails) {
                                                            if (roleDetails[name]) {
                                                                if (secondarySubNav.pathName == name) {
                                                                    // console.log(secondarySubNav.pathName, name) //Add remove menu here 
                                                                    return (
                                                                        <AuthorityCheck
                                                                            authority={secondarySubNav.authority}
                                                                            userAuthority={userAuthority}
                                                                            key={secondarySubNav.key}
                                                                        >
                                                                            {secondarySubNav.subMenu.length > 0 ? (
                                                                                <Dropdown.Menu
                                                                                    title={t(
                                                                                        secondarySubNav.translateKey,
                                                                                        secondarySubNav.title
                                                                                    )}
                                                                                >
                                                                                    {secondarySubNav.subMenu.filter(canSeeNav).map(
                                                                                        (tertiarySubNav) => (
                                                                                            <AuthorityCheck
                                                                                                authority={
                                                                                                    tertiarySubNav.authority
                                                                                                }
                                                                                                userAuthority={
                                                                                                    userAuthority
                                                                                                }
                                                                                                key={
                                                                                                    tertiarySubNav.key
                                                                                                }
                                                                                            >
                                                                                                <HorizontalMenuDropdownItem
                                                                                                    nav={
                                                                                                        tertiarySubNav
                                                                                                    }
                                                                                                />
                                                                                            </AuthorityCheck>
                                                                                        )
                                                                                    )}
                                                                                </Dropdown.Menu>
                                                                            ) : (
                                                                                <HorizontalMenuDropdownItem
                                                                                    nav={secondarySubNav}
                                                                                    key={secondarySubNav.key}
                                                                                />
                                                                            )}
                                                                        </AuthorityCheck>
                                                                    )
                                                                }
                                                            }
                                                        }
                                                    })
                                                }
                                            </Dropdown>
                                        </AuthorityCheck>
                                    )
                                }
                                if (nav.type === NAV_ITEM_TYPE_ITEM) {
                                    return (
                                        <AuthorityCheck
                                            authority={nav.authority}
                                            userAuthority={userAuthority}
                                            key={nav.key}
                                        >
                                            <HorizontalMenuItem
                                                isLink
                                                nav={nav}
                                                manuVariant={manuVariant}
                                            />
                                        </AuthorityCheck>
                                    )
                                }
                            }
                        }
                    }
                    // return <></>
                })}
            </span>
            <div className={`flex items-center ${newMenu.personalized ? 'visible' : 'hidden'}`}>
                {
                    filterNav(seletedNavConfig, roleDetails).map((nav, index) => {
                        if (newMenu.personalizedMenu.length > 0) {
                            for (let i = 0; i < newMenu.personalizedMenu.length; i++) {
                                if (nav.personalizeMenu == newMenu.personalizedMenu[i]) {
                                    if (nav.type === NAV_ITEM_TYPE_ITEM) {
                                        return (
                                            <AuthorityCheck
                                                authority={nav.authority}
                                                userAuthority={userAuthority}
                                                key={nav.key}
                                            >
                                                <HorizontalMenuItem
                                                    isLink
                                                    nav={nav}
                                                    manuVariant={manuVariant}
                                                />
                                            </AuthorityCheck>
                                        )
                                    }
                                }
                            }
                        }
                        // newMenu.personalizedMenu.map((value, index) => {
                        // if (nav.personalizeMenu === value) {
                        //     }
                        // })
                        // return <></>
                    })}
            </div>
            <span className={`flex items-center ${newMenu.personalized ? 'visible' : 'hidden'}`} >
                {filterNav(otherNavConfig, roleDetails).map((nav) => {
                    return (
                        <AuthorityCheck
                            authority={nav.authority}
                            userAuthority={userAuthority}
                            key={nav.key}
                        >
                            <Dropdown
                                trigger="hover"
                                renderTitle={
                                    <HorizontalMenuItem
                                        manuVariant={manuVariant}
                                        nav={nav}
                                        key={nav.key}
                                    />
                                }
                            >
                                {
                                    nav.subMenu.map((secondarySubNav) => {
                                        // A group with nothing this role can open is not shown
                                        if (secondarySubNav.subMenu.length > 0 && !secondarySubNav.subMenu.some(canSeeNav)) return null
                                        for (let name in roleDetails) {
                                            if (roleDetails[name]) {
                                                // console.log(secondarySubNav.pathName, name) //Add remove menu here 
                                                if (secondarySubNav.pathName == name || secondarySubNav.pathName == 'home') {
                                                    return (
                                                        <AuthorityCheck
                                                            authority={secondarySubNav.authority}
                                                            userAuthority={userAuthority}
                                                            key={secondarySubNav.key}
                                                        >
                                                            {secondarySubNav.subMenu.length > 0 ? (
                                                                <Dropdown.Menu
                                                                    title={t(
                                                                        secondarySubNav.translateKey,
                                                                        secondarySubNav.title
                                                                    )}
                                                                >
                                                                    {secondarySubNav.subMenu.filter(canSeeNav).map(
                                                                        (tertiarySubNav) => (
                                                                            <AuthorityCheck
                                                                                authority={
                                                                                    tertiarySubNav.authority
                                                                                }
                                                                                userAuthority={
                                                                                    userAuthority
                                                                                }
                                                                                key={
                                                                                    tertiarySubNav.key
                                                                                }
                                                                            >
                                                                                <HorizontalMenuDropdownItem
                                                                                    nav={
                                                                                        tertiarySubNav
                                                                                    }
                                                                                />
                                                                            </AuthorityCheck>
                                                                        )
                                                                    )}
                                                                </Dropdown.Menu>
                                                            ) : (
                                                                <HorizontalMenuDropdownItem
                                                                    nav={secondarySubNav}
                                                                    key={secondarySubNav.key}
                                                                />
                                                            )}
                                                        </AuthorityCheck>
                                                    )
                                                }
                                            }
                                        }
                                    })
                                }
                            </Dropdown>
                        </AuthorityCheck>
                    )
                })}
            </span>
        </>
    )
}

export default HorizontalMenuContent
