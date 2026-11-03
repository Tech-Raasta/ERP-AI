import { Button, FormContainer, FormItem, Notification, toast } from 'components/ui'
import { Field, Form, Formik } from 'formik'
import React from 'react'
import * as Yup from 'yup'
import PasswordInput from './PasswordInput'
import { apiResetPassword } from 'services/AuthService'
import { useSelector } from 'react-redux'

const validationSchema = Yup.object().shape({
    password: Yup.string().required('Please enter your password').min(6, "Password Length Must be greater that equal to 6 "),
    confirmPassword: Yup.string()
    .oneOf([Yup.ref('password'), null], 'Passwords must match') // Matches password field
    .required('Confirm password is required'),
})
const ResetPassForm = ({data, onCheckDialog}) => {

    const {userId} = useSelector((state) => state.auth.user);

    const onSubmit = async (values, actions) => {
        const { password } = values
        actions.setSubmitting(true);
        apiResetPassword({password}, userId).then(data=>{
            // console.log("data",data);
            if(data.status === 200){
                actions.setSubmitting(false);
                toast.push(
                    <Notification
                        title="Success"
                        type="success"
                        closable
                    >
                        {data.data['message']}
                    </Notification>
                )
                actions.resetForm();
                onCheckDialog(false);
            }
        }).catch(error=>{
            // console.log("error", error);
            const errors = error.response;
            const errorData = errors.data.error.errors;
            if(errors.status === 422){
                for (const errMsg in errorData) {
                    actions.setFieldError(
                        errMsg,
                        errorData[errMsg]['message']
                    )
                }
            }
            actions.setSubmitting(false);

        })
        // setTimeout(() => {
        //     setSubmitting(false);
        //     onCheckDialog(false);
        // }, 3000);
    }
  return (
    <div>
        <div className="flex flex-col items-center gap-0 h-full">
            <h5 className={data && data.code === ""? "mb-4 text-center" :"mb-0 text-center"}>Reset Password</h5>
            {
                data && (
                <>
                    <p className="mb-4 text-center">{data.message}</p>
                {/* <button onClick={() => onCheckDialog(false)}>
                    Close Me
                    </button> */}
                </>
            )
        }
        </div>
        <Formik
            initialValues={{
                password: '',
                confirmPassword: '',
            }}
            validationSchema={validationSchema}
            onSubmit={(values, actions) => {
                onSubmit(values, actions)
            }}
        >
            {({ touched, errors, isSubmitting }) => (
                <Form autoComplete='off' >
                    <FormContainer>
                        <FormItem
                            label="Password"
                            invalid={
                                errors.password && touched.password
                            }
                            errorMessage={errors.password}
                        >
                            <Field
                                autoComplete="off"
                                name="password"
                                placeholder="Password"
                                component={PasswordInput}
                            />
                        </FormItem>
                        <FormItem
                            label="Confirm Password"
                            invalid={
                                errors.confirmPassword &&
                                touched.confirmPassword
                            }
                            errorMessage={errors.confirmPassword}
                        >
                            <Field
                                autoComplete="off"
                                name="confirmPassword"
                                placeholder="Confirm Password"
                                component={PasswordInput}
                            />
                        </FormItem>
                        <Button
                            block
                            loading={isSubmitting}
                            variant="solid"
                            type="submit"
                        >
                            {isSubmitting
                                ? 'Submiting...'
                                : 'Submit'}
                        </Button>
                    </FormContainer>
                </Form>
            )}
        </Formik>
    </div>
  )
}

export default ResetPassForm
