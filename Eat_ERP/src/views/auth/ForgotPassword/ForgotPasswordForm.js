import React, { useState } from 'react'
import { Input, Button, FormItem, FormContainer, Alert } from 'components/ui'
import { ActionLink } from 'components/shared'
import { apiForgotPassword } from 'services/AuthService'
import { Field, Form, Formik } from 'formik'
import * as Yup from 'yup'

// Forgot password: the user gives their email and gets a link to set a new password (controllers/passwordReset.js).
// The answer is the same whether or not the email has an account.

const validationSchema = Yup.object().shape({
    email: Yup.string().trim().email('Please enter a valid email').required('Please enter your email'),
})

const ForgotPasswordForm = (props) => {
    const { disableSubmit = false, className, signInUrl = '/sign-in' } = props

    const [sentTo, setSentTo] = useState('')
    const [sentMessage, setSentMessage] = useState('')
    const [message, setMessage] = useState('')

    const onSendMail = async (values, { setSubmitting, setFieldError }) => {
        setMessage('')
        try {
            const resp = await apiForgotPassword({ email: values.email.trim() })
            setSentTo(values.email.trim())
            setSentMessage(resp.data['message'])
        } catch (error) {
            const data = (error && error.response && error.response.data) || {}
            const field = data.error && data.error.errors && data.error.errors.email
            if (field) setFieldError('email', field.message)
            else setMessage(data.message || 'The email could not be sent. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className={className}>
            <div className="mb-6">
                {sentTo ? (
                    <>
                        <h3 className="mb-1">Check your email</h3>
                        <p>{sentMessage}</p>
                        <p className="mt-2 text-sm text-gray-500">Sent for <span className="font-semibold">{sentTo}</span>. Nothing there? Check the spam folder, or send it again.</p>
                    </>
                ) : (
                    <>
                        <h3 className="mb-1">Forgot Password</h3>
                        <p>Enter the email you sign in with. We will send you a link to set a new password.</p>
                    </>
                )}
            </div>
            {message && (
                <Alert className="mb-4" type="danger" showIcon>
                    {message}
                </Alert>
            )}
            <Formik
                initialValues={{ email: '' }}
                validationSchema={validationSchema}
                onSubmit={(values, actions) => {
                    if (!disableSubmit) {
                        onSendMail(values, actions)
                    } else {
                        actions.setSubmitting(false)
                    }
                }}
            >
                {({ touched, errors, isSubmitting }) => (
                    <Form autoComplete="off">
                        <FormContainer>
                            <div className={sentTo ? 'hidden' : ''}>
                                <FormItem
                                    label="Email"
                                    invalid={errors.email && touched.email}
                                    errorMessage={errors.email}
                                >
                                    <Field
                                        type="email"
                                        autoComplete="username"
                                        name="email"
                                        placeholder="name@company.com"
                                        component={Input}
                                    />
                                </FormItem>
                            </div>
                            <Button block loading={isSubmitting} variant="solid" type="submit">
                                {sentTo ? 'Send the link again' : 'Send reset link'}
                            </Button>
                            <div className="mt-4 text-center">
                                <span>Remembered it? </span>
                                <ActionLink to={signInUrl}>Sign in</ActionLink>
                            </div>
                        </FormContainer>
                    </Form>
                )}
            </Formik>
        </div>
    )
}

export default ForgotPasswordForm
