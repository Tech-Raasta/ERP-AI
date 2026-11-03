import React from 'react'
import {
    HiOutlineColorSwatch,
    HiOutlineDesktopComputer,
    HiOutlineTemplate,
    HiOutlineViewGridAdd,
    HiOutlineHome,
    HiDocumentReport,
    HiOutlineCalendar, HiOutlineUsers,
} from 'react-icons/hi'


import { BiRupee } from "react-icons/bi";
import { GiFactory } from "react-icons/gi";
import { TbReportMoney } from 'react-icons/tb';

const navigationIcon = {
    home: <HiOutlineHome />,
    singleMenu: <HiOutlineViewGridAdd />,
    collapseMenu: <HiOutlineTemplate />,
    groupSingleMenu: <HiOutlineDesktopComputer />,
    groupCollapseMenu: <HiOutlineColorSwatch />,
    rupee: <BiRupee />,
    moneyCheck: <TbReportMoney />,
    factory: <GiFactory />,
    report:<HiDocumentReport />,
    users: <HiOutlineUsers />,
    attendance: <HiOutlineCalendar />,
}

export default navigationIcon
