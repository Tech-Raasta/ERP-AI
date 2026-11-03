import React, { useEffect, useState } from 'react'
import { Avatar, Dropdown } from 'components/ui'
import withHeaderItem from 'utils/hoc/withHeaderItem'
import useAuth from 'utils/hooks/useAuth'
// import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import classNames from 'classnames'
import { HiOutlineUser, HiOutlineLogout, HiOutlineCog } from 'react-icons/hi'
import deepParseJson from 'utils/deepParseJson'
// import {
//     NAV_ITEM_TYPE_ITEM,
// } from 'constants/navigation.constant'
import { useDispatch, useSelector } from 'react-redux'
import { setMenu } from 'store/auth/menuSlice'
import Checkbox from 'components/ui/Checkbox'
import Button from 'components/ui/Buttons'
import Dialog from 'components/ui/Dialog'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import Switcher from 'components/ui/Switcher'
import { apiSetFavourites } from 'services/AuthService'
import ResetPassForm from 'components/shared/ResetPassForm'
const dropdownItemList = []

const personalOptions = [
    { value: "product", name: 'product', pathName: 'product' },
    { value: "category", name: 'category', pathName: 'category' },
    { value: "box", name: 'box', pathName: 'box' },
    { value: "vendor", name: 'vendor', pathName: 'vendor' },
    { value: "addVendor", name: 'add Vendor', pathName: 'vendor' },
    { value: "rawMaterial", name: 'raw Material', pathName: 'rawMaterial' },
    { value: "addRawMaterial", name: 'add Raw Material', pathName: 'rawMaterial' },
    { value: "packagingMaterial", name: 'packaging Material', pathName: 'packagingMaterial' },
    { value: "addPackagingMaterial", name: 'Add Packaging Material', pathName: 'packagingMaterial' },
    { value: "pincodeMaster", name: 'Pincode Master', pathName: 'cityMaster' },
    { value: "cityMaster", name: 'City Master', pathName: 'cityMaster' },
    { value: "vendorType", name: 'Vendor Type', pathName: 'master' },
    { value: "asset", name: 'Asset', pathName: 'rawMaterial' },
    { value: "batchMaster", name: 'Batch Master', pathName: 'master' },
    { value: "recipeMaster", name: 'Recipe Master', pathName: 'master' },
    { value: "salesRep", name: 'Sales Representative', pathName: 'master' },
    { value: "distributor", name: 'Distributor/Retailer', pathName: 'master' },
    { value: "distributorType", name: 'Distributor Type', pathName: 'master' },
    { value: "zone", name: 'Zone', pathName: 'master' },
    { value: "area", name: 'Area', pathName: 'master' },
    { value: "location", name: 'Location', pathName: 'master' },
    { value: "purchaseOrder", name: 'purchase Order', pathName: 'purchaseOrder' },
    { value: "addPurchaseOrder", name: 'add Purchase Order', pathName: 'purchaseOrder' },
    { value: "productionPlanning", name: 'Production Planning', pathName: 'purchaseOrder' },
    { value: "addProductionPlanning", name: 'Add Production Planning', pathName: 'purchaseOrder' },
    { value: "rawMaterialInOut", name: 'Raw Material In/Out', pathName: 'goodsReceivedNote' },
    { value: "addRawMaterialInOut", name: 'Add Raw Material In/Out', pathName: 'goodsReceivedNote' },
    { value: "depotTransfer", name: 'Depot Transfer', pathName: 'depotTransfer' },
    { value: "addDepotTransfer", name: 'Add Depot Transfer', pathName: 'depotTransfer' },
    { value: "depotTransferUpload", name: 'Depot Transfer Upload', pathName: 'depotTransferUpload' },
    { value: "goodsReceivedNote", name: 'goods Received Note', pathName: 'goodsReceivedNote' },
    { value: "addGoodsReceivedNote", name: 'add Goods Received Note', pathName: 'goodsReceivedNote' },
    { value: "invoiceProcessing", name: 'invoice Processing', pathName: 'invoiceProcessing' },
    { value: "financeVoucher", name: 'finance Voucher', pathName: 'financeVoucher' },
    { value: "addFinanceVoucher", name: 'add Finance Voucher', pathName: 'financeVoucher' },
    { value: "vendorPayment", name: 'vendor Payment', pathName: 'vendorPayment' },
    { value: "addVendorPayment", name: 'add Vendor Payment', pathName: 'vendorPayment' },
    { value: "salesOut", name: 'Sales', pathName: 'salesOut' },
    { value: "sampleExpiry", name: 'Sample / Expiry', pathName: 'transaction' },
    { value: "salesReturn", name: 'Sales Return', pathName: 'transaction' },
    { value: "endOfMonthSales", name: 'End of Month Sales Details', pathName: 'endOfMonthSales' },
    { value: "batchProcessing", name: 'batch Processing', pathName: 'batchProcessing' },
    { value: "salesUpload", name: 'Sales Upload', pathName: 'transaction' },
    { value: "salesReturnUpload", name: 'Sales Return Upload', pathName: 'transaction' },
    { value: "paymentDetails", name: 'Payment Details', pathName: 'transaction' },
    { value: "creditDebitNote", name: 'Credit Debit Note', pathName: 'transaction' },
    { value: "oldPaymentUpload", name: 'Old Payment Upload', pathName: 'transaction' },
    { value: "userMaster", name: 'User', pathName: 'user' },
    { value: "attendance", name: 'Eat Attendance', pathName: 'attendance' },
    { value: "userRoles", name: 'User Roles', pathName: 'userRoles' },
    { value: "ezycomInventory", name: 'Ezycom Inventory', pathName: 'ezycomInventory' },
    { value: "productionManager", name: 'Production Approver', pathName: 'productionManager' },
    { value: "productionFloorManager", name: 'Production Floor Manger', pathName: 'productionFloorManager' },
    { value: "storeManager", name: 'Store Manager', pathName: 'storeManager' },
    { value: "reports", name: 'Reports', pathName: 'reports' }
]

export const UserDropdown = ({ className }) => {
    // bind this
    const userInfo = useSelector((state) => state.auth.user)
    const selectedMenu = useSelector((state) => state.auth.selectedMenu)
    // const [user, setUser] = useState({
    //     userName: "",
    //     authority: ["Admin"],
    //     email: ""
    // });
    const { signOut } = useAuth()
    const dispatch = useDispatch();
    useEffect(() => {
        // const userData = deepParseJson(localStorage.getItem('admin'));
        // console.log(userData.auth.user);
        // setUser({
        //     userName: userInfo.userName,
        //     email: userInfo.email,
        //     authority: ["Admin"],
        // })
        setShowHide(selectedMenu.personalized)
        setCheckboxList(selectedMenu.personalizedMenu)
    }, []);
    const UserAvatar = (
        <div className={classNames(className, 'flex items-center gap-2')}>
            <Avatar size={32} shape="circle" icon={<HiOutlineUser />} />
            <div className="hidden md:block">
                <div className="text-xs capitalize">{userInfo.authority}</div>
                <div className="font-bold">{userInfo.userName}</div>

            </div>
        </div>
    )

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
        storeManager: 0,
        depotTransfer:0,
        reports:0,
    }

    // Favourites can only be chosen from what the role may open
    roleDetails = userInfo.roleDetails && typeof userInfo.roleDetails === 'object' ? userInfo.roleDetails : {}


    const [dialogIsOpen, setIsOpen] = useState(false)
    const [showHide, setShowHide] = useState(false)
    const [checkboxList, setCheckboxList] = useState([])

    // console.log(selectedMenu)
    const onCheckboxChange = (options, e) => {
        console.log(options)
        setCheckboxList(options)
    }

    const onSwitcherToggle = (value) => {
        setShowHide(!value)
    }

    const onDialogClose = (e) => {
        setShowHide(selectedMenu.personalized)
        setCheckboxList(selectedMenu.personalizedMenu)
        setIsOpen(false)
    }

    const onDialogOk = (e) => {
        // console.log('onDialogOk', e)
        const id = userInfo.userId;
        if (showHide) {
            if (checkboxList.length <= 5) {
                apiCall({
                    show_favourites: showHide,
                    favourites: checkboxList,
                    id
                })
            } else {
                toast.push(
                    <Notification
                        title="Error"
                        type="danger"
                        closable
                    >
                        Only Below 5 Personalize Menu Can Be Added.
                    </Notification>
                )
            }
        } else {
            setCheckboxList([])
            apiCall({
                show_favourites: showHide,
                favourites: [],
                id
            })
            // setIsOpen(false)
            // dispatch(setMenu({
            //     personalized: showHide,
            //     personalizedMenu: []
            // }))
        }
    }

    const apiCall = (values) => {
        apiSetFavourites(values).then(data => {
            console.log(data);
            if (data.status === 200) {
                setIsOpen(false)
                dispatch(setMenu({
                    personalized: values.show_favourites,
                    personalizedMenu: values.favourites
                }))
            } else if (data.status === 400 || data.status === 404 || data.status === 401 || data.status === 500) {
                toast.push(
                    <Notification
                        title="Error"
                        type="danger"
                        closable
                    >
                        Something Went Wrong. Please Try Again Later
                    </Notification>
                )
            }

        }).catch(error => {
            if (error.response.status === 400 || error.response.status === 404 || error.response.status === 401 || error.response.status === 500) {
                toast.push(
                    <Notification
                        title="Error"
                        type="danger"
                        closable
                    >
                        Something Went Wrong. Please Try Again Later
                    </Notification>
                )
            }
        })
    }

    const openPopup = () => {
        setIsOpen(true)
    }


    const [open, setOpen] = useState(false);

    const handleData = (childData) => {
        setOpen(childData);
    };

    return (
        <div>
            <Dropdown
                menuStyle={{ minWidth: 240 }}
                renderTitle={UserAvatar}
                placement="bottom-end"
            >
                <Dropdown.Item variant="header">
                    <div className="py-2 px-3 flex items-center gap-2">
                        <Avatar shape="circle" icon={<HiOutlineUser />} />
                        <div>
                            <div className="font-bold text-gray-900 dark:text-gray-100">
                                {userInfo.userName}
                            </div>
                            <div className="text-xs">{userInfo.email}</div>
                        </div>
                    </div>
                </Dropdown.Item>
                <Dropdown.Item variant="divider" />
                {dropdownItemList.map((item) => (
                    <Dropdown.Item
                        key={item.label}
                        eventKey={item.label}
                        className="mb-1 px-0"
                    >
                        <Link
                            className="flex h-full w-full px-2"
                            to={item.path}
                        >
                            <span className="flex gap-2 items-center w-full">
                                <span className="text-xl opacity-50">
                                    {item.icon}
                                </span>
                                <span>{item.label}</span>
                            </span>
                        </Link>
                    </Dropdown.Item>
                ))}
                <Dropdown.Item onClick={() => openPopup()}>
                    <span className="text-xl opacity-50">
                        <HiOutlineCog />
                    </span>
                    <span>Personalize Menu</span>
                </Dropdown.Item>
                <Dropdown.Item onClick={() => setOpen(true)}>
                    <span className="text-xl opacity-50">
                        <HiOutlineCog />
                    </span>
                    <span>Reset Password</span>
                </Dropdown.Item>
                <Dropdown.Item variant="divider" />
                <Dropdown.Item
                    onClick={signOut}
                    eventKey="Sign Out"
                    className="gap-2"
                >
                    <span className="text-xl opacity-50">
                        <HiOutlineLogout />
                    </span>
                    <span>Sign Out</span>
                </Dropdown.Item>
            </Dropdown>
            <Dialog
                isOpen={dialogIsOpen}
                onClose={onDialogClose}
                onRequestClose={onDialogClose}
            >
                <h5 className="mb-4">Personalize Menu</h5>
                <div className='flex items-center mb-4'>
                    {/* <Checkbox checked={showHide} onChange={onCheck}>
                        Checkbox
                    </Checkbox> */}
                    <Switcher checked={showHide} onChange={onSwitcherToggle} /> <span className='ml-2'>Customisation Enable/Disable</span>
                </div>
                <div className={`max-h-64 overflow-y-auto ${showHide ? 'visible' : 'hidden'}`}>
                    <Checkbox.Group vertical value={checkboxList} onChange={onCheckboxChange}>
                        {
                            personalOptions.map((data, index) => {
                                for (let name in roleDetails) {
                                    if (roleDetails[name]) {
                                        if (data.pathName == name) {
                                            return (
                                                <Checkbox value={data.value} key={index}> <span className=' capitalize'>{data.name}</span> </Checkbox>
                                            )
                                        }
                                    }
                                }
                            })
                        }
                    </Checkbox.Group>
                </div>
                <div className="text-right mt-6">
                    <Button
                        className="ltr:mr-2 rtl:ml-2"
                        variant="plain"
                        onClick={onDialogClose}
                    >
                        Cancel
                    </Button>
                    <Button variant="solid" onClick={onDialogOk}>
                        Save
                    </Button>
                </div>
            </Dialog>

            <Dialog isOpen={open} closable={true} height={400} onClose={()=>setOpen(false)}>
                <ResetPassForm onCheckDialog={handleData} />
            </Dialog>
        </div>
    )
}

export default withHeaderItem(UserDropdown)
