import { combineReducers } from '@reduxjs/toolkit'
import session from './sessionSlice'
import user from './userSlice'
import selectedMenu from './menuSlice'

const reducer = combineReducers({
    session,
    user,
    selectedMenu
})

export default reducer
