import React, { useEffect, useMemo, useState } from 'react'
import { FormItem, FormContainer } from 'components/ui'
import AdaptableCard from 'components/shared/AdaptableCard'
import Input from 'components/ui/Input'
import Select from 'components/ui/Select'
import Checkbox from 'components/ui/Checkbox'
import Button from 'components/ui/Buttons'
import Loading from 'components/shared/Loading'
import StickyFooter from 'components/shared/StickyFooter'
import Table from 'components/ui/Table'
import { Field, Form, Formik, getIn } from 'formik'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import {
    apiUserRoleGetSingle,
    apiUserRoleMasterData,
    apiUserRolePost,
    apiUserRoleUpdate,
} from 'services/UserRoleService'

const { Tr, Th, Td, THead, TBody } = Table

// User Role add / edit / copy (old PHP user_role_details.php): what the role may do in each module, and which reports
// it sees. A global role opens read only; it can be copied.

const LIST = '/user/user-roles'
const RIGHTS = [
    { key: 'r_view', label: 'View' },
    { key: 'r_insert', label: 'Insert' },
    { key: 'r_edit', label: 'Update' },
    { key: 'r_delete', label: 'Delete' },
    { key: 'r_approvals', label: 'Approval' },
    { key: 'r_export', label: 'Download' },
]
const STATUSES = [{ value: 'Approved', label: 'Active' }, { value: 'InActive', label: 'InActive' }]
const HEADER = 'sticky top-0 z-10 bg-white dark:bg-gray-800'

const text = (value) => (value === null || value === undefined ? '' : String(value).trim())
const blank = () => ({ role_name: '', description: '', status: 'Approved', options: {}, reports: [] })

const validate = (values) => {
    const errors = {}
    if (!text(values.role_name)) errors.role_name = 'Role Is Required'
    const anyRight = Object.values(values.options).some((rights) => RIGHTS.some(({ key }) => +rights[key] === 1))
    if (!anyRight) errors.options = 'Please assign atleast one role.'
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

const AddEditUserRole = ({ copy = false }) => {
    const { roleid } = useParams()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [formValues, setFormValues] = useState(blank())
    const [record, setRecord] = useState(null)
    const [permissions, setPermissions] = useState({ submit: false, copy: false })
    const [sections, setSections] = useState([])
    const [reportGroups, setReportGroups] = useState([])
    const [serverErrors, setServerErrors] = useState({})

    useEffect(() => {
        setLoading(true)
        const requests = [apiUserRoleMasterData()]
        if (roleid) requests.push(apiUserRoleGetSingle(roleid))
        Promise.all(requests)
            .then(([master, single]) => {
                setSections(master.data['sections'] || [])
                setReportGroups(master.data['reports'] || [])
                const canAdd = !!(master.data['action'] || {}).insert
                if (!single) {
                    setRecord(null)
                    setFormValues(blank())
                    setPermissions({ submit: canAdd, copy: false })
                    return
                }
                const { role, options, reports, permissions: allowed } = single.data
                setFormValues({
                    role_name: copy ? `${role.role_name} 1` : role.role_name,
                    description: text(role.description),
                    status: role.status === 'InActive' ? 'InActive' : 'Approved',
                    options,
                    reports,
                })
                setRecord(copy ? null : role)
                setPermissions(copy ? { submit: canAdd, copy: false } : allowed)
            })
            .catch((error) => showMessage(error && error.response ? error.response.data['message'] : 'Fetching user role failed'))
            .finally(() => setLoading(false))
    }, [roleid, copy])

    const onSubmit = (values, actions) => {
        setServerErrors({})
        const request = record ? apiUserRoleUpdate(record.id, values) : apiUserRolePost(values)
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
    const grouped = useMemo(() => {
        const groups = []
        sections.forEach((row) => {
            const last = groups[groups.length - 1]
            if (last && last.group === row.group) last.rows.push(row)
            else groups.push({ group: row.group, rows: [row] })
        })
        return groups
    }, [sections])

    return (
        <Loading loading={loading}>
            <Formik initialValues={formValues} enableReinitialize validate={validate} onSubmit={onSubmit}>
                {({ values, errors, touched, isSubmitting, setFieldValue, submitCount, isValid }) => {
                    const form = { values, errors, touched, submitCount }
                    const fe = (name) => fieldFeedback(form, name, serverErrors)
                    const has = (section, right) => +((values.options[section] || {})[right]) === 1
                    const setRight = (section, right, checked) => setFieldValue('options', {
                        ...values.options,
                        [section]: { ...(values.options[section] || {}), [right]: checked ? 1 : 0 },
                    })
                    const columnRows = (right) => sections.filter((row) => row.rights.includes(right))
                    const wholeColumn = (right) => columnRows(right).length > 0 && columnRows(right).every((row) => has(row.section, right))
                    const setColumn = (right, checked) => {
                        const options = { ...values.options }
                        columnRows(right).forEach(({ section }) => {
                            options[section] = { ...(options[section] || {}), [right]: checked ? 1 : 0 }
                        })
                        setFieldValue('options', options)
                    }
                    const setReports = (ids, checked) => setFieldValue(
                        'reports',
                        checked ? [...new Set([...values.reports, ...ids])] : values.reports.filter((id) => !ids.includes(id))
                    )
                    const rightsError = (submitCount > 0 && errors.options) || (serverErrors.options && serverErrors.options.message)

                    return (
                        <Form>
                            <SubmitErrorNotice submitCount={submitCount} isValid={isValid} />
                            <FormContainer>
                                <AdaptableCard className="mb-4 card-shadow" divider>
                                    <h5 className="mb-4">{record ? (editable ? 'Edit User Role' : 'View User Role') : copy ? 'Copy User Role' : 'Add User Role'}</h5>
                                    {record && record.global ? (
                                        <p className="mb-4 text-amber-600">This is a global role and cannot be changed. Copy it to make your own version.</p>
                                    ) : null}
                                    {record && !record.global && !editable ? <p className="mb-4 text-amber-600">You cannot change this role.</p> : null}
                                    <div className="grid md:grid-cols-3 gap-4">
                                        <FormItem asterisk label="Role" invalid={fe('role_name').invalid} errorMessage={fe('role_name').errorMessage}>
                                            <Field name="role_name" as={Input} placeholder="Role" disabled={!editable} />
                                        </FormItem>
                                        <FormItem label="Status" invalid={fe('status').invalid} errorMessage={fe('status').errorMessage}>
                                            <Select
                                                isDisabled={!editable}
                                                options={STATUSES}
                                                value={STATUSES.filter((option) => option.value === values.status)}
                                                onChange={(option) => setFieldValue('status', option ? option.value : 'Approved')}
                                            />
                                        </FormItem>
                                        <FormItem label="Role Description">
                                            <Field name="description" as={Input} placeholder="Description" disabled={!editable} />
                                        </FormItem>
                                    </div>
                                </AdaptableCard>

                                <AdaptableCard className="mb-4 card-shadow" divider>
                                    <h5 className="mb-2">Module Access</h5>
                                    {rightsError ? <p className="mb-2 text-red-600">{rightsError}</p> : null}
                                    {/* Scrolls inside itself so the rights stay labelled over all 45 modules */}
                                    <div className="overflow-auto" style={{ maxHeight: '65vh' }}>
                                        <Table compact className="border">
                                            <THead>
                                                <Tr>
                                                    <Th className={HEADER} style={{ minWidth: 260 }}>Module</Th>
                                                    {RIGHTS.map(({ key, label }) => (
                                                        <Th key={key} className={`${HEADER} text-center`} style={{ minWidth: 90 }}>
                                                            <Checkbox disabled={!editable} checked={wholeColumn(key)} onChange={(checked) => setColumn(key, checked)}>
                                                                {label}
                                                            </Checkbox>
                                                        </Th>
                                                    ))}
                                                </Tr>
                                            </THead>
                                            <TBody>
                                                {grouped.map(({ group, rows }) => (
                                                    <React.Fragment key={group}>
                                                        <Tr>
                                                            <Td colSpan={RIGHTS.length + 1} className="font-semibold bg-gray-50 dark:bg-gray-700">{group}</Td>
                                                        </Tr>
                                                        {rows.map(({ section, label, note, rights }) => (
                                                            <Tr key={section}>
                                                                <Td>
                                                                    {label}
                                                                    {note ? <div className="text-xs text-gray-500">{note}</div> : null}
                                                                </Td>
                                                                {RIGHTS.map(({ key }) => (
                                                                    <Td key={key} className="text-center">
                                                                        {rights.includes(key) ? (
                                                                            <Checkbox disabled={!editable} checked={has(section, key)} onChange={(checked) => setRight(section, key, checked)} />
                                                                        ) : null}
                                                                    </Td>
                                                                ))}
                                                            </Tr>
                                                        ))}
                                                    </React.Fragment>
                                                ))}
                                            </TBody>
                                        </Table>
                                    </div>
                                </AdaptableCard>

                                <AdaptableCard className="mb-4 card-shadow" divider>
                                    <h5 className="mb-4">Reports</h5>
                                    <div className="grid md:grid-cols-4 gap-6">
                                        {reportGroups.map(({ group, reports }) => {
                                            const ids = reports.map((report) => report.id)
                                            return (
                                                <div key={group}>
                                                    <div className="mb-2 font-semibold">
                                                        <Checkbox disabled={!editable} checked={ids.every((id) => values.reports.includes(id))} onChange={(checked) => setReports(ids, checked)}>
                                                            {group}
                                                        </Checkbox>
                                                    </div>
                                                    {reports.map((report) => (
                                                        <div key={report.id} className="mb-1">
                                                            <Checkbox disabled={!editable} checked={values.reports.includes(report.id)} onChange={(checked) => setReports([report.id], checked)}>
                                                                {report.name}
                                                            </Checkbox>
                                                        </div>
                                                    ))}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </AdaptableCard>

                                <StickyFooter
                                    className="px-8 flex items-center justify-end py-4"
                                    stickyClass="border-t bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600"
                                >
                                    <Button size="sm" className="ltr:mr-3" type="button" onClick={() => navigate(LIST)}>Cancel</Button>
                                    {record && permissions.copy ? (
                                        <Button size="sm" className="ltr:mr-3" type="button" onClick={() => navigate(`/user/user-roles/copy/${record.id}`)}>Copy</Button>
                                    ) : null}
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

export default AddEditUserRole
