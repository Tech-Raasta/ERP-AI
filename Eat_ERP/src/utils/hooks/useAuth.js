import { useSelector, useDispatch } from 'react-redux'
import { setUser, initialState } from 'store/auth/userSlice'
import { apiSignUp } from 'services/AuthService'
import { signInOnServer, signOutOnServer, startSession, endSession, announceSignIn } from 'utils/session'
import { onSignInSuccess, onSignOutSuccess } from 'store/auth/sessionSlice'
import appConfig from 'configs/app.config'
import { REDIRECT_URL_KEY } from 'constants/app.constant'
import { useNavigate } from 'react-router-dom'
import useQuery from './useQuery'
import { menuState, setMenu } from 'store/auth/menuSlice'

// The user as the store keeps it, from the sign-in answer or /user/me
export const userFrom = (data) => ({
    avatar: '',
    userName: data.userName || data.email || '',
    authority: [data.role ? data.role.role_name : ''],
    email: data.email || '',
    userId: data.userId || '',
    userRoleId: data.userRoleId || '',
    roleDetails: data.roleDetails && typeof data.roleDetails === 'object' ? data.roleDetails : {},
})

export const menuFrom = (data) => ({
    personalized: data.show_favourites != null && +data.show_favourites === 1,
    personalizedMenu: data.favourites != null ? (typeof data.favourites === 'string' ? JSON.parse(data.favourites) : data.favourites) : [],
})

function useAuth() {
    const dispatch = useDispatch()

    const navigate = useNavigate()

    const query = useQuery()

    const { signedIn } = useSelector((state) => state.auth.session)

    const signIn = async (values) => {
        try {
            const resp = await signInOnServer(values)
            if (resp.data && resp.data.token) {
                startSession(resp.data)
                announceSignIn()
                // Always the user of this sign-in, so nothing of a previous user (or no role at all) is left behind
                dispatch(setUser(userFrom(resp.data)))
                dispatch(setMenu(menuFrom(resp.data)))
                dispatch(onSignInSuccess(resp.data.token))
                const redirectUrl = query.get(REDIRECT_URL_KEY)
                navigate(
                    redirectUrl ? redirectUrl : appConfig.authenticatedEntryPath
                )
                return {
                    status: 'success',
                    message: '',
                }
            }
        } catch (errors) {
            return {
                status: 'failed',
                message: errors?.response?.data?.message || errors.toString(),
            }
        }
    }

    const signUp = async (values) => {
        try {
            const resp = await apiSignUp(values)
            if (resp.data) {
                const { token } = resp.data
                dispatch(onSignInSuccess(token))
                if (resp.data.user) {
                    dispatch(
                        setUser(
                            resp.data.user || {
                                avatar: '',
                                userName: 'Anonymous',
                                authority: ['USER'],
                                email: '',
                            }
                        )
                    )
                }
                const redirectUrl = query.get(REDIRECT_URL_KEY)
                navigate(
                    redirectUrl ? redirectUrl : appConfig.authenticatedEntryPath
                )
                return {
                    status: 'success',
                    message: '',
                }
            }
        } catch (errors) {
            return {
                status: 'failed',
                message: errors?.response?.data?.message || errors.toString(),
            }
        }
    }

    const handleSignOut = () => {
        endSession()
        dispatch(onSignOutSuccess())
        dispatch(setUser(initialState))
        dispatch(setMenu(menuState))
        navigate(appConfig.unAuthenticatedEntryPath)
    }

    // The browser is signed out even when the server cannot be reached
    // The server ends the session and removes the cookie; the browser signs out even when it cannot be reached
    const signOut = async () => {
        await signOutOnServer()
        handleSignOut()
    }

    return {
        authenticated: !!signedIn,
        signIn,
        signUp,
        signOut,
    }
}

export default useAuth
