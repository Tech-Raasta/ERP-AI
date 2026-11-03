import React, { useEffect } from 'react'
import {
    Html5Qrcode,
    Html5QrcodeScanner,
    Html5QrcodeSupportedFormats,
} from 'html5-qrcode'

const Scanner = ({ qrCodeSuccessCallback }) => {
    useEffect(() => {
        // // const scanner = new Html5QrcodeScanner('reader', {
        // //     qrbox: {
        // //         width: 500,
        // //         height: 500,
        // //     },
        // //     fps: 10,
        // //     formatsToSupport: [Html5QrcodeSupportedFormats.CODE_128],
        // // })
        // // scanner.render(props.qrCodeSuccessCallback, props.qrCodeErrorCallback)
        const html5QrCode = new Html5Qrcode(
            'reader',
            Html5QrcodeSupportedFormats.CODE_128
        )
        // var cameraId
        // This method will trigger user permissions
        html5QrCode.start(
            {facingMode:'environment'}, // retreived in the previous step.
            {
                fps: 5, // sets the framerate to 10 frame per second
                qrbox: { width: 400, height: 250 }, // sets only 250 X 250 region of viewfinder to
                // scannable, rest shaded.
            },
            (qrCodeSuccessCallback1) => {
                // do something when code is read. For example:
                // console.log(
                //     `QR Code detected: ${qrCodeSuccessCallback}`
                // )
                qrCodeSuccessCallback(qrCodeSuccessCallback1.trim())
                html5QrCode.stop();
            }
        ).catch((err) => {
            // Start failed, handle it. For example,
            console.log(
                `Unable to start scanning, error: ${err}`
            )
        })
        // return () => {
        // }
        // when component mounts
        // const config = createConfig(props)
        // const verbose = props.verbose === true
        // Suceess callback is required.
        if (!qrCodeSuccessCallback) {
            throw new Error('qrCodeSuccessCallback is required callback.')
        }
        // const html5QrcodeScanner = new Html5QrcodeScanner(
        //     'reader',
        //     {
        //         fps: 10,
        //         formatsToSupport: [Html5QrcodeSupportedFormats.CODE_128],
        //         qrbox: { width: 400, height: 250 },
        //     },
        //     true
        // )
        // html5QrcodeScanner.render(qrCodeSuccessCallback)

        // html5QrCode.start({ facingMode: "environment" }, config, qrCodeSuccessCallback);

        // cleanup function when component will unmount
        return () => {
            // html5QrcodeScanner.clear().catch((error) => {
            //     console.error('Failed to clear html5QrcodeScanner. ', error)
            // })
            // html5QrcodeScanner.getState()
            console.log('Cleaning up Scanner', html5QrCode.isScanning)
            if(html5QrCode.isScanning){
                console.log('Stopping Camera On Close')
                html5QrCode.stop().then((res)=>{
                    html5QrCode.clear()
                })
            }
        }
    },[])
    return <div id="reader"></div>
}

export default Scanner
