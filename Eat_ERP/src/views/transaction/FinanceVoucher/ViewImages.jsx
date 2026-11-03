import React, { useState } from 'react'
import Button from 'components/ui/Buttons'
import {
    BiRotateRight,
    BiRotateLeft,
    BiZoomIn,
    BiZoomOut,
} from 'react-icons/bi'

const ViewImages = ({ url, name }) => {
    let check = url.includes('.pdf')
    const [rotate, setRotate] = useState(0)
    const [zoom, setZoom] = useState(1)
    const rotateImage = () => {
        console.log('rotating')
        setRotate((prev) => {
            if (prev > 180) {
                return 0
            } else {
                return prev + 90
            }
        })
    }

    const rotateImageLeft = () => {
        console.log('rotating')
        setRotate((prev) => {
            if (prev < -180) {
                return 0
            } else {
                return prev - 90
            }
        })
    }

    const imageZoomIn = () => {
        setZoom((prev) => {
            if (prev > 3) {
                return 3.2
            } else {
                return prev + 0.2
            }
        })
    }
    const imageZoomOut = () => {
        setZoom((prev) => {
            if (prev < 1.2) {
                return 1
            } else {
                return prev - 0.2
            }
        })
    }

    return (
        <>
            {check ? (
                <iframe
                    src={url}
                    title={name}
                    width={'100%'}
                    height={'700'}
                    className="pdfPrint"
                />
            ) : (
                <div className="relative">
                    <div
                        className="absolute top-[15px] left-[15px] z-10 flex justify-start"
                        id="actionButtons"
                    >
                        <Button
                            shape="circle"
                            size="sm"
                            variant="twoTone"
                            icon={<BiRotateLeft />}
                            className="mr-2"
                            onClick={(e) => {
                                e.stopPropagation()
                                rotateImageLeft()
                            }}
                        />
                        <Button
                            shape="circle"
                            size="sm"
                            variant="twoTone"
                            icon={<BiRotateRight />}
                            className="mr-2"
                            onClick={(e) => {
                                e.stopPropagation()
                                rotateImage()
                            }}
                        />
                        <Button
                            shape="circle"
                            size="sm"
                            variant="twoTone"
                            icon={<BiZoomIn />}
                            className="mr-2"
                            onClick={(e) => {
                                e.stopPropagation()
                                imageZoomIn()
                            }}
                        />
                        <Button
                            shape="circle"
                            size="sm"
                            variant="twoTone"
                            icon={<BiZoomOut />}
                            className="mr-2"
                            onClick={(e) => {
                                e.stopPropagation()
                                imageZoomOut()
                            }}
                        />
                    </div>
                    <div>
                        <img
                            src={url}
                            alt={name}
                            width={'100%'}
                            style={{
                                transform: `rotate(${rotate}deg) scale(${zoom})`,
                            }}
                        />
                    </div>
                </div>
            )}
        </>
    )
}

export default ViewImages
