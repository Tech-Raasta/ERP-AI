import { createSlice } from '@reduxjs/toolkit'

export const menuState = {
    personalized: false,
    personalizedMenu: []
}

export const menuSlice = createSlice({
    name: 'auth/selectedMenu',
    initialState: menuState,
    reducers: {
        setMenu: (_, action) => action.payload,
    },
})

export const { setMenu } = menuSlice.actions

export default menuSlice.reducer
