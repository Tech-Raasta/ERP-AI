import React, { useEffect, useRef, useState } from 'react'
import { FormItem, FormContainer } from 'components/ui'
import AdaptableCard from 'components/shared/AdaptableCard'
import Input from 'components/ui/Input'
import Select from 'components/ui/Select'
import Checkbox from 'components/ui/Checkbox'
import Button from 'components/ui/Buttons'
import Loading from 'components/shared/Loading'
import StickyFooter from 'components/shared/StickyFooter'
import { Field, Form, Formik, getIn } from 'formik'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import { apiUserGetSingle, apiUserMasterData, apiUserPost, apiUserUpdate } from 'services/UserService'

// User add / edit (old PHP user_details.php). The password is not on this form: a new user starts on the default
// password and changes it at first login. Many old users do not meet today's rules (a full name in First Name, no
// mobile), so on an edit a rule applies only to a field being changed, here and on the server.

const LIST = '/user/user'
const NAME = /^[a-z][a-z .'-]*$/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MOBILE = /^[0-9]{10}$/
const STATUSES = [{ value: 'Approved', label: 'Active' }, { value: 'InActive', label: 'InActive' }]

const text = (value) => (value === null || value === undefined ? '' : String(value).trim())

const blank = () => ({
    first_name: '', middle_name: '', last_name: '', email_id: '', mobile: '', emp_code: '', in_time: '11:00',
    role_id: '', status: 'Approved', remarks: '', depot_ids: [],
})

const validate = (original) => (values) => {
    const errors = {}
    const changed = (key) => !original || text(values[key]) !== text(original[key])
    if (changed('first_name')) {
        if (!text(values.first_name)) errors.first_name = 'First Name Is Required'
        else if (!NAME.test(text(values.first_name))) errors.first_name = 'Letters Only Please'
    }
    if (changed('last_name')) {
        if (!text(values.last_name)) errors.last_name = 'Last Name Is Required'
        else if (!NAME.test(text(values.last_name))) errors.last_name = 'Letters Only Please'
    }
    if (changed('email_id')) {
        if (!text(values.email_id)) errors.email_id = 'Email ID Is Required'
        else if (!EMAIL.test(text(values.email_id))) errors.email_id = 'Enter A Valid Email ID'
    }
    if (changed('mobile')) {
        if (!text(values.mobile)) errors.mobile = 'Mobile No Is Required'
        else if (!MOBILE.test(text(values.mobile))) errors.mobile = 'Mobile No Should Be 10 Digits'
    }
    if (!values.role_id) errors.role_id = 'Role Is Required'
    return errors
}

// Server errors stay on their field until that field changes
const fieldFeedback = (form, name, serverErrors = {}) => {
    const error = getIn(form.errors, name)
    const touch = getIn(form.touched, name)
    const server = serverErrors[name] && serverErrors[name].value === getIn(form.values, name) ? serverErrors[name].message : ''
    return {
        errorMessage: typeof error === 'string' ? error : server || '',
        invalid: (typeof error === 'string' && (!!touch || form.submitCount > 0)) || !!server,
    }
}

const SubmitErrorNotice = ({ submitCount, isValid }) => {
    useEffect(() => {
        if (submitCount > 0 && !isValid) {
            toast.push(<Notification title="Error" type="danger" closable>Please correct the highlighted fields.</Notification>)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [submitCount])
    return null
}

const showMessage = (message, type = 'danger') => {
    toast.push(
        <Notification title={type === 'success' ? 'Success' : 'Error'} type={type} closable>
            {message}
        </Notification>
    )
}

const AddEditUser = () => {
    const { userid } = useParams()
    const navigate = useNavigate()
    const formRef = useRef()
    const [loading, setLoading] = useState(true)
    const [formValues, setFormValues] = useState(blank())
    const [record, setRecord] = useState(null)
    const [permissions, setPermissions] = useState({ submit: false, self: false })
    const [roles, setRoles] = useState([])
    const [depots, setDepots] = useState([])
    const [serverErrors, setServerErrors] = useState({})

    useEffect(() => {
        const requests = [apiUserMasterData()]
        if (userid) requests.push(apiUserGetSingle(userid))
        Promise.all(requests)
            .then(([master, single]) => {
                const roleList = master.data['roles'] || []
                setDepots(master.data['depots'] || [])
                if (!single) {
                    setRoles(roleList)
                    setPermissions({ submit: !!(master.data['action'] || {}).insert, self: false })
                    return
                }
                const { user, permissions: allowed } = single.data
                // A role that is no longer active still shows for the user who has it
                setRoles(user.role_id && !roleList.some((role) => role.id === user.role_id)
                    ? [...roleList, { id: user.role_id, role_name: user.role_name || `Role ${user.role_id}` }]
                    : roleList)
                setRecord(user)
                setPermissions(allowed)
                setFormValues({
                    ...Object.fromEntries(Object.keys(blank()).map((key) => [key, user[key] === null || user[key] === undefined ? '' : user[key]])),
                    depot_ids: user.depot_ids || [],
                })
            })
            .catch((error) => showMessage(error && error.response ? error.response.data['message'] : 'Fetching user failed'))
            .finally(() => setLoading(false))
    }, [userid])

    const onSubmit = (values, actions) => {
        setServerErrors({})
        const request = record ? apiUserUpdate(record.id, values) : apiUserPost(values)
        request
            .then((res) => {
                showMessage(res.data['message'], 'success')
                navigate(LIST)
            })
            .catch((error) => {
                actions.setSubmitting(false)
                if (!error || !error.response) return
                const errors = error.response.data && error.response.data.error && error.response.data.error.errors
                if (error.response.status === 422 && errors) {
                    const next = {}
                    Object.keys(errors).forEach((key) => {
                        next[key] = { message: errors[key]['message'], value: getIn(values, key) }
                        showMessage(errors[key]['message'])
                    })
                    setServerErrors(next)
                } else {
                    showMessage(error.response.data['message'])
                }
            })
    }

    const editable = permissions.submit
    const roleOptions = roles.map((role) => ({ value: role.id, label: role.role_name }))

    return (
        <Loading loading={loading}>
            <Formik innerRef={formRef} initialValues={formValues} enableReinitialize validate={validate(record)} onSubmit={onSubmit}>
                {({ values, errors, touched, isSubmitting, setFieldValue, submitCount, isValid }) => {
                    const form = { values, errors, touched, submitCount }
                    const fe = (name) => fieldFeedback(form, name, serverErrors)
                    const input = (name, label, extra = {}) => {
                        const { asterisk, ...rest } = extra
                        return (
                            <FormItem asterisk={asterisk} label={label} invalid={fe(name).invalid} errorMessage={fe(name).errorMessage}>
                                <Field name={name} as={Input} placeholder={label} disabled={!editable} {...rest} />
                            </FormItem>
                        )
                    }
                    const allDepots = depots.length > 0 && depots.every((depot) => values.depot_ids.includes(depot.id))
                    return (
                        <Form>
                            <SubmitErrorNotice submitCount={submitCount} isValid={isValid} />
                            <FormContainer>
                                <AdaptableCard className="mb-4 card-shadow" divider>
                                    <h5 className="mb-4">{record ? 'Edit User' : 'Add User'}</h5>
                                    {!record ? <p className="mb-4 text-gray-500">The new user logs in with the default password and is asked to change it.</p> : null}
                                    <div className="grid md:grid-cols-3 gap-4">
                                        {input('first_name', 'First Name', { asterisk: true })}
                                        {input('middle_name', 'Middle Name')}
                                        {input('last_name', 'Last Name', { asterisk: true })}
                                        {input('email_id', 'Email ID', { asterisk: true })}
                                        {input('mobile', 'Mobile No', { asterisk: true, maxLength: 10 })}
                                        {input('emp_code', 'Employee Code')}
                                        {input('in_time', 'In Time', { type: 'time' })}
                                        <FormItem asterisk label="Role" invalid={fe('role_id').invalid} errorMessage={fe('role_id').errorMessage}>
                                            <Select
                                                placeholder="Select"
                                                isDisabled={!editable || permissions.self}
                                                options={roleOptions}
                                                value={roleOptions.filter((option) => option.value === values.role_id)}
                                                onChange={(option) => setFieldValue('role_id', option ? option.value : '')}
                                            />
                                        </FormItem>
                                        <FormItem label="Status" invalid={fe('status').invalid} errorMessage={fe('status').errorMessage}>
                                            <Select
                                                isDisabled={!editable || permissions.self}
                                                options={STATUSES}
                                                value={STATUSES.filter((option) => option.value === values.status)}
                                                onChange={(option) => setFieldValue('status', option ? option.value : 'Approved')}
                                            />
                                        </FormItem>
                                    </div>
                                    {permissions.self ? <p className="text-sm text-gray-500">You cannot change your own role or status.</p> : null}
                                </AdaptableCard>

                                <AdaptableCard className="mb-4 card-shadow" divider>
                                    <div className="flex items-center justify-between mb-4">
                                        <h5>Depots</h5>
                                        <Checkbox
                                            disabled={!editable}
                                            checked={allDepots}
                                            onChange={(checked) => setFieldValue('depot_ids', checked ? depots.map((depot) => depot.id) : [])}
                                        >
                                            Select All
                                        </Checkbox>
                                    </div>
                                    <div className="grid md:grid-cols-3 gap-2">
                                        {depots.map((depot) => (
                                            <Checkbox
                                                key={depot.id}
                                                disabled={!editable}
                                                checked={values.depot_ids.includes(depot.id)}
                                                onChange={(checked) => setFieldValue(
                                                    'depot_ids',
                                                    checked ? [...values.depot_ids, depot.id] : values.depot_ids.filter((id) => id !== depot.id)
                                                )}
                                            >
                                                {depot.depot_name}
                                            </Checkbox>
                                        ))}
                                    </div>
                                </AdaptableCard>

                                <AdaptableCard className="mb-4 card-shadow" divider>
                                    {input('remarks', 'Remarks', { textArea: true })}
                                </AdaptableCard>

                                <StickyFooter
                                    className="px-8 flex items-center justify-end py-4"
                                    stickyClass="border-t bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600"
                                >
                                    <Button size="sm" className="ltr:mr-3" type="button" onClick={() => navigate(LIST)}>Cancel</Button>
                                    {editable ? <Button size="sm" variant="solid" type="submit" loading={isSubmitting}>Save</Button> : null}
                                </StickyFooter>
                            </FormContainer>
                        </Form>
                    )
                }}
            </Formik>
        </Loading>
    )
}

export default AddEditUser
