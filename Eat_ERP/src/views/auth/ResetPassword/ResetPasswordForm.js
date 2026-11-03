import React, { useEffect, useState } from 'react'
import { Button, FormItem, FormContainer, Alert } from 'components/ui'
import { PasswordInput, ActionLink } from 'components/shared'
import Loading from 'components/shared/Loading'
import { apiCheckResetLink, apiResetPasswordWithLink } from 'services/AuthService'
import { useLocation, useNavigate } from 'react-router-dom'
import { Field, Form, Formik } from 'formik'
import * as Yup from 'yup'

// Opened from the forgot-password email (?token=...). The link is checked first, so an expired or used link says so
// at once instead of after the user has typed a new password.

const MIN_LENGTH = 6

const validationSchema = Yup.object().shape({
    password: Yup.string().required('Please enter a new password').min(MIN_LENGTH, `The password must have at least ${MIN_LENGTH} characters`),
    confirmPassword: Yup.string().required('Please enter the password again').oneOf([Yup.ref('password'), null], 'The passwords do not match'),
})

const ResetPasswordForm = (props) => {
    const { disableSubmit = false, className, signInUrl = '/sign-in', forgotUrl = '/forgot-password' } = props

    const { search } = useLocation()
    const token = new URLSearchParams(search).get('token') || ''
    const navigate = useNavigate()

    // checking -> ready | invalid -> done
    const [state, setState] = useState(token ? 'checking' : 'invalid')
    const [email, setEmail] = useState('')
    const [message, setMessage] = useState(token ? '' : 'This page opens from the link in the reset email. Ask for a new link below.')

    useEffect(() => {
        if (!token) return
        apiCheckResetLink({ token })
            .then((res) => {
                setEmail(res.data['email'] || '')
                setState('ready')
            })
            .catch((error) => {
                setMessage((error && error.response && error.response.data && error.response.data.message) || 'This link could not be checked.')
                setState('invalid')
            })
    }, [token])

    const onSubmit = async (values, { setSubmitting, setFieldError }) => {
        setMessage('')
        try {
            const resp = await apiResetPasswordWithLink({ token, ...values })
            setMessage(resp.data['message'])
            setState('done')
        } catch (error) {
            const data = (error && error.response && error.response.data) || {}
            const fields = data.error && data.error.errors
            if (fields) {
                Object.entries(fields).forEach(([name, item]) => setFieldError(name, item.message))
            } else {
                setMessage(data.message || 'The password could not be changed. Please try again.')
                if (/expired|used/i.test(data.message || '')) setState('invalid')
            }
        } finally {
            setSubmitting(false)
        }
    }

    const heading = {
        checking: ['Checking your link', 'One moment…'],
        ready: ['Set a new password', `Choose a new password${email ? ` for ${email}` : ''}. It must be different from your current one.`],
        invalid: ['Link not valid', 'Reset links work for 30 minutes and only once.'],
        done: ['Password changed', 'You can now sign in with your new password.'],
    }[state]

    return (
        <div className={className}>
            <div className="mb-6">
                <h3 className="mb-1">{heading[0]}</h3>
                <p>{heading[1]}</p>
            </div>
            {message && (
                <Alert className="mb-4" type={state === 'done' ? 'success' : 'danger'} showIcon>
                    {message}
                </Alert>
            )}
            <Loading loading={state === 'checking'}>
                {state === 'ready' ? (
                    <Formik
                        initialValues={{ password: '', confirmPassword: '' }}
                        validationSchema={validationSchema}
                        onSubmit={(values, actions) => {
                            if (!disableSubmit) onSubmit(values, actions)
                            else actions.setSubmitting(false)
                        }}
                    >
                        {({ touched, errors, isSubmitting }) => (
                            <Form autoComplete="off">
                                <FormContainer>
                                    <FormItem label="New password" invalid={errors.password && touched.password} errorMessage={errors.password}>
                                        <Field autoComplete="new-password" name="password" placeholder="New password" component={PasswordInput} />
                                    </FormItem>
                                    <FormItem label="Confirm new password" invalid={errors.confirmPassword && touched.confirmPassword} errorMessage={errors.confirmPassword}>
                                        <Field autoComplete="new-password" name="confirmPassword" placeholder="Confirm new password" component={PasswordInput} />
                                    </FormItem>
                                    <Button block loading={isSubmitting} variant="solid" type="submit">
                                        {isSubmitting ? 'Saving…' : 'Save new password'}
                                    </Button>
                                </FormContainer>
                            </Form>
                        )}
                    </Formik>
                ) : null}
                {state === 'invalid' ? (
                    <Button block variant="solid" type="button" onClick={() => navigate(forgotUrl)}>Ask for a new link</Button>
                ) : null}
                {state === 'done' ? (
                    <Button block variant="solid" type="button" onClick={() => navigate(signInUrl)}>Go to sign in</Button>
                ) : null}
                {state !== 'done' ? (
                    <div className="mt-4 text-center">
                        <span>Back to </span>
                        <ActionLink to={signInUrl}>Sign in</ActionLink>
                    </div>
                ) : null}
            </Loading>
        </div>
    )
}

export default ResetPasswordForm
