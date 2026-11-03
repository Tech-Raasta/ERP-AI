import { io } from 'socket.io-client'
import appConfig from 'configs/app.config'


export const socket = io(appConfig.socketUrl, {
    transports:['polling']
})