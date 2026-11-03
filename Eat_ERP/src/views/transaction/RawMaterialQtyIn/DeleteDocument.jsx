import React,{ useState, useRef, useEffect } from 'react'
import Notification from 'components/ui/Notification'
import toast from 'components/ui/toast'
import ViewImages from '../FinanceVoucher/ViewImages'
import classNames from 'classnames'
import Segment from 'components/ui/Segment'
import Dialog from 'components/ui/Dialog'
import Button from 'components/ui/Buttons'
import { HiCheckCircle } from 'react-icons/hi'
import { apiDeleteAttachment } from 'services/RawMaterialQtyInService'
import appConfig from 'configs/app.config'

const DeleteDocument = ({id, documents, isOpen, setIsDocumentOpen}) => {
    const [isConfirm, setIsConfirm] = useState(false)
    // const [isDocDelete, setIsDocDelete] = useState(false)
    const [isStoreDeleted, setIsStoreDeleted] = useState([])

    const closeDocDelete = (e) => {
        console.log('onDialogClose', e)
        setIsStoreDeleted([])
        setIsDocumentOpen({isOpen:false})
    }

    const submitDeleted = () =>{
        if(isStoreDeleted.length > 0){
            setIsConfirm(true)
        }else{
            toast.push(
                <Notification title="Error" type="danger" closable>
                    Please Select Document To Delete!
                </Notification>
            )
        }
    }

    const onConfirmClose = (e) => {
        // console.log('onDialogClose', e)
        setIsConfirm(false)
    }

    const confirmDeleted = ()=>{
        console.log(id)
        console.log(isStoreDeleted)
        apiDeleteAttachment(id, {documents: isStoreDeleted}).then(data=>{
            console.log(data)
            if(data.status === 200){
                toast.push(
                    <Notification title="Success" type="success" closable>
                        { data.data['message'] }
                    </Notification>
                )
                setIsStoreDeleted([])
                setIsConfirm(false)
                setIsDocumentOpen({isOpen:false, documents: data.data['rawMaterialIn'].document_name})
            }
        })
    }
  return (
    <>
        <Dialog
            isOpen={isOpen}
            onClose={closeDocDelete}
            onRequestClose={closeDocDelete}
            contentClassName="p-5 mt-8 mb-8"
            // width={700}
            height={`90vh`}
        >
            <div className="flex flex-col h-full justify-between gap-3">
                <h3>Delete Uploaded </h3>
                <Segment className="gap-2 flex-col overflow-y-auto" defaultValue={[]} selectionType="multiple" onChange={(segmentValue) =>setIsStoreDeleted(segmentValue)}>
                    { documents ? documents.map((value, index) => (
                        <Segment.Item
                            key={index}
                            value={value}
                            // disabled={item.disabled}
                        >
                            {({ active, value, onSegmentItemClick, disabled }) => {
                                return (
                                    <div
                                        className={classNames(
                                            'flex',
                                            'ring-1',
                                            'justify-between',
                                            'border',
                                            'rounded-md ',
                                            'border-gray-300',
                                            'py-5 px-4',
                                            'cursor-pointer',
                                            'select-none',
                                            'w-100',
                                            'relative',
                                            // 'md:w-[260px]',
                                            active
                                                ? 'ring-cyan-500 border-cyan-500'
                                                : 'ring-transparent',
                                            disabled
                                                ? 'opacity-50 cursor-not-allowed'
                                                : 'hover:ring-cyan-500 hover:border-cyan-500'
                                        )}
                                        onClick={onSegmentItemClick}
                                    >
                                        <div className='flex items-center' key={index}>
                                            {/* <p>{value}</p> */}
                                            <div className='w-[400px] overflow-auto'>
                                                <ViewImages
                                                    url={`${appConfig.uploadUrl}raw_material_in/${value}`}
                                                    name={value}
                                                    key={index}
                                                ></ViewImages>
                                            </div>

                                        </div>
                                        {/* <div>
                                        </div> */}
                                        {active && (
                                            <HiCheckCircle className="text-cyan-500 text-[30px] absolute top-3 right-3"/>
                                        )}
                                    </div>
                                )
                            }}
                        </Segment.Item>
                    )) : null}
                </Segment>
                <div className='flex justify-end gap-2'>
                    <Button
                        size="sm"
                        type="button"
                        onClick={closeDocDelete}
                    >
                        Close
                    </Button>
                    <Button
                        size="sm"
                        type="button"
                        variant="solid"
                        color="rose-600"
                        onClick={() =>
                            submitDeleted()
                        }
                    >
                        Delete
                    </Button>
                </div>
            </div>
        </Dialog>
        <Dialog
            isOpen={isConfirm}
            onClose={onConfirmClose}
            onRequestClose={onConfirmClose}
        >
            <h5 className="mb-4">Confirmation</h5>
            <p>Are you sure want to delete selected documents?</p>
            <div className="text-right mt-6">
                <Button
                    className="ltr:mr-2 rtl:ml-2"
                    variant="solid"
                    color="red-600"
                    type="button"
                    onClick={onConfirmClose}
                >
                    No
                </Button>
                <Button
                    variant="solid"
                    color="emerald-600"
                    type="button"
                    onClick={confirmDeleted}
                >
                    Yes
                </Button>
            </div>
    </Dialog>
    </>
  )
}

export default DeleteDocument
