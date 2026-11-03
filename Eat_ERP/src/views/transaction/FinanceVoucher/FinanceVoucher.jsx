import React, { useState, useEffect, useMemo, useRef } from 'react'
import AdaptableCard from 'components/shared/AdaptableCard'
import DataTable from 'components/shared/DataTable'
import Tabs from 'components/ui/Tabs'
import debounce from 'lodash/debounce'
import Button from 'components/ui/Buttons'
import Input from 'components/ui/Input'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import { Link, useNavigate } from 'react-router-dom'
import { MdCreate, MdAdd, MdImportExport, MdOutlinePrint } from 'react-icons/md'
import { HiSearch } from 'react-icons/hi'
import { apiFinanceVoucherGet } from 'services/FinanceVoucherService'
import NumberFormat from 'react-number-format'
import { exportToExcel } from 'react-easy-export'

const { TabNav, TabList, TabContent } = Tabs

const FinanceVoucher = () => {
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(true)
    const [tableData, setTableData] = useState({
        total: 0,
        pageIndex: 1,
        pageSize: 10,
        query: '',
        sort: {
            order: '',
            key: '',
        },
        status: 'pending',
    })

    const [statusCount, setStatusCount] = useState({
        inProcess: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        inActive: 8,
    })

    const tabChanges = (tab) => {
        setTableData((prevData) => ({
            ...prevData,
            ...{ status: tab, pageIndex: 1 },
        }))
        localStorage.setItem('financeVoucher', JSON.stringify({ pageSize:tableData.pageSize, pageIndex:1, status: tab }))
    }

    const navigate = useNavigate()
    const inputRef = useRef(null)

    const debounceFn = debounce(handleDebounceFn, 1000)

    function handleDebounceFn(val) {
        if (typeof val === 'string' && (val.length > 1 || val.length === 0)) {
            setTableData((prevData) => ({
                ...prevData,
                ...{ query: val, pageIndex: 1 },
            }))
        }
    }

    const handleChange = (e) => {
        debounceFn(e.target.value)
    }

    const columns = useMemo(
        () => [
            {
                header: 'Sr. No.',
                cell: (props) =>
                    props.row.index +
                    1 +
                    tableData.pageSize * (tableData.pageIndex - 1),
                width: 60,
            },
            {
                header: 'Invoice Date',
                accessorKey: 'invoice_date',
                cell: (props) => {
                    let a = new Date(props.row.original.invoice_date)
                    return `${
                        a.getDate() < 10 ? '0' + a.getDate() : a.getDate()
                    }-${
                        a.getMonth() + 1 < 10
                            ? '0' + (a.getMonth() + 1)
                            : a.getMonth() + 1
                    }-${a.getFullYear()}`
                },
                width: 110,
            },
            {
                header: 'Type',
                accessorKey: 'type',
                width: 100,
                cell: (props) => (
                    <p className=" capitalize"> {props.row.original.type} </p>
                ),
            },
            {
                header: 'Party Name',
                accessorKey: 'vendor_name',
            },
            {
                header: 'Invoice No.',
                accessorKey: 'invoice_no',
            },
            {
                header: 'Total Payable Amount',
                accessorKey: 'total_payable',
                cell: (props) => (
                    <NumberFormat
                        displayType="text"
                        prefix={'₹'}
                        thousandsGroupStyle={'lakh'}
                        decimalScale={2}
                        value={props.row.original.total_payable}
                        allowLeadingZeros
                        thousandSeparator=","
                    />
                ),
                width: 150,
            },
            {
                header: 'Paid Amount',
                accessorKey: 'paid_amount',
                cell: (props) => (
                    <NumberFormat
                        displayType="text"
                        prefix={'₹'}
                        thousandsGroupStyle={'lakh'}
                        decimalScale={2}
                        value={props.row.original.paid_amount}
                        allowLeadingZeros
                        thousandSeparator=","
                    />
                ),
                width: 150,
            },
            {
                header: 'Action',
                width: 125,
                cell: (props) => (
                    <>
                        {
                            props.row.original.type.toString().toLowerCase() === 'expense' || props.row.original.is_advance ? (
                                <Link to={`/transaction/finance-voucher/edit-new-finance-voucher/${props.row.original.id}`}>
                                    <Button
                                        shape="circle"
                                        size="sm"
                                        variant="twoTone"
                                        icon={<MdCreate />}
                                        className="mr-3"
                                    />
                                </Link>
                            ):(
                                <Link to={`/transaction/finance-voucher/edit-finance-voucher/${props.row.original.id}`}>
                                    <Button
                                        shape="circle"
                                        size="sm"
                                        variant="twoTone"
                                        icon={<MdCreate />}
                                        className="mr-3"
                                    />
                                </Link>
                            )
                        }
                        <Link to={`/transaction/finance-voucher/view-finance-voucher/${props.row.original.id}`}>
                            <Button
                                shape="circle"
                                size="sm"
                                color="blue-600"
                                variant="twoTone"
                                icon={<MdOutlinePrint />}
                                className={`mr-3 ${
                                    tableData.status === 'approved'
                                        ? 'visible'
                                        : 'hidden'
                                }`}
                            />
                        </Link>
                    </>
                ),
            },
        ],
        [tableData.pageIndex, tableData.pageSize, tableData.status]
    )

    const handlePaginationChange = (pageIndex) => {
        setTableData((prevData) => ({ ...prevData, ...{ pageIndex } }))
        localStorage.setItem('financeVoucher', JSON.stringify({ pageSize:tableData.pageSize, pageIndex, status: tableData.status }))
    }

    const handleSelectChange = (pageSize) => {
        setTableData((prevData) => ({ ...prevData, ...{ pageSize } }))
        localStorage.setItem('financeVoucher', JSON.stringify({ pageSize, pageIndex:tableData.pageIndex, status: tableData.status }))
    }

    const handleSort = ({ order, key }) => {
        setTableData((prevData) => ({
            ...prevData,
            ...{ sort: { order, key } },
        }))
    }

    console.log('FinanceVoucher.js Loading....')


    // useEffect(() => {
    // }, []);

    const getFinanceData = (data)=>{
        apiFinanceVoucherGet(data)
            .then((data) => {
                if (data.data) {
                    setStatusCount(data.data['statusCount'])
                    setData(data.data['rows'])
                    setTableData((prevData) => ({
                        ...prevData,
                        ...{ total: data.data['total'] },
                    }))
                    setLoading(false)
                }
            })
            .catch((error) => {
                if (error.response.status === 500) {
                    console.log(error)
                    toast.push(
                        <Notification title="Error" type="danger" closable>
                            {error.response.data['message']}
                        </Notification>
                    )
                    // setLoading(false)
                } else if (error.response.status === 401) {
                    toast.push(
                        <Notification title="Error" type="danger" closable>
                            {error.response.data['message']}
                        </Notification>
                    )
                }
                setLoading(false)
            })
    } 

    useEffect(() => {
        const fetchData = () => {
            setLoading(true)
            if (localStorage.getItem('financeVoucher')){
                let data = JSON.parse(localStorage.getItem('financeVoucher')) 
                // console.log(data.status)
                setTableData(prev=>({...prev, pageSize:data.pageSize, pageIndex:data.pageIndex, status:data.status}))
                getFinanceData({...tableData, pageSize:data.pageSize, pageIndex:data.pageIndex, status:data.status})
            }else{
                getFinanceData(tableData)
            }
            
            return true
        }
        fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        tableData.pageIndex,
        tableData.sort,
        tableData.pageSize,
        tableData.query,
        tableData.status,
    ])

    const downloadAll = () => {
        apiFinanceVoucherGet({
            total: 0,
            pageIndex: 1,
            pageSize: 'all',
            query: '',
            sort: {
                order: '',
                key: '',
            },
            status: tableData.status,
        })
            .then((data) => {
                if (data.data) {
                    exportToExcel(
                        data.data['rows'],
                        `finance-voucher-${new Date().toLocaleString()}.xls`
                    )
                }
            })
            .catch((error) => {
                if (error.response.status === 500) {
                    console.log(error)
                    setLoading(false)
                } else if (error.response.status === 401) {
                    toast.push(
                        <Notification title="Error" type="danger" closable>
                            {error.response.data['message']}
                        </Notification>
                    )
                }
            })
    }

    return (
        <AdaptableCard className="card-shadow">
            <div className="lg:flex items-center justify-between mb-0">
                <h3 className="mb-0 lg:mb-0 ">Finance Voucher</h3>
                <div className="flex flex-row lg:flex-row lg:items-center">
                    <Input
                        ref={inputRef}
                        placeholder="Search..."
                        size="sm"
                        className="lg:w-52 mr-4"
                        onChange={handleChange}
                        prefix={<HiSearch className="text-lg" />}
                    />
                    <Link
                        to={'/transaction/finance-voucher/add-finance-voucher'}
                        className=" mr-4 inline-flex"
                    >
                        <Button size="sm" variant="solid" icon={<MdAdd />}>
                            <span>Add Finance Voucher</span>
                        </Button>
                    </Link>
                    <div className=" inline-flex">
                        <Button
                            size="sm"
                            variant="solid"
                            className="mr-4"
                            color="emerald-600"
                            icon={<MdImportExport />}
                            onClick={() => {
                                exportToExcel(
                                    data,
                                    `finance-voucher-${new Date().toLocaleString()}.xls`
                                )
                            }}
                            disabled={!data.length > 0}
                        >
                            <span>Download</span>
                        </Button>
                        <Button
                            size="sm"
                            variant="solid"
                            color="emerald-600"
                            icon={<MdImportExport />}
                            onClick={() => {
                                downloadAll()
                            }}
                            disabled={!data.length > 0}
                        >
                            <span>Download All</span>
                        </Button>
                    </div>
                </div>
            </div>

            <Tabs
                defaultValue={localStorage.getItem('financeVoucher') === null ? 'pending' : JSON.parse(localStorage.getItem('financeVoucher')).status}
                onChange={(tabValue) => {
                    tabChanges(tabValue)
                }}
            >
                <TabList className="justify-end">
                    <TabNav value="inProcess">
                        In Process {`(${statusCount.inProcess})`}
                    </TabNav>
                    <TabNav value="pending">
                        Pending Approval {`(${statusCount.pending})`}
                    </TabNav>
                    <TabNav value="rejected">
                        Rejected {`(${statusCount.rejected})`}
                    </TabNav>
                    <TabNav value="inactive">
                        Inactive {`(${statusCount.inActive})`}
                    </TabNav>
                    <TabNav value="approved">
                        Approved {`(${statusCount.approved})`}
                    </TabNav>
                </TabList>
                <div className="p-1">
                    <TabContent value="inProcess"></TabContent>
                    <TabContent value="pending"></TabContent>
                    <TabContent value="rejected"></TabContent>
                    <TabContent value="inactive"></TabContent>
                    <TabContent value="approved"></TabContent>
                </div>
            </Tabs>
            <DataTable
                columns={columns}
                data={data}
                loading={loading}
                pagingData={tableData}
                onPaginationChange={handlePaginationChange}
                onSelectChange={handleSelectChange}
                onSort={handleSort}
            />
        </AdaptableCard>
    )
}

export default FinanceVoucher
