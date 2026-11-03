import { createSlice } from '@reduxjs/toolkit'

export const sessionSlice = createSlice({
    name: 'auth/session',
    initialState: {
        token: '',
        signedIn: false,
        expired:false,
        data:{}
    },
    reducers: {
        // The token itself is kept in memory by utils/session, never in the store (which may be saved)
        onSignInSuccess: (state) => {
            state.signedIn = true
            state.token = ''
        },
        onSignOutSuccess: (state) => {
            state.signedIn = false
            state.token = ''
        },
        setToken: (state, action) => {
            state.token = action.payload
        },
        checkExpiry: (state, action)=>{
            if(action.payload === null){
                state.expired = false
            }else{
                state.expired = true
                state.data = action.payload
            }

        }
    },
})

export const { onSignInSuccess, onSignOutSuccess, setToken, checkExpiry } =
    sessionSlice.actions

export default sessionSlice.reducer
