import React from 'react'

const ViewPaymentUpload = () => {
  return (
        <div style={{ width: "100%", float: "left", marginRight: 20 }}>
            <center style={{ width: "100%", display: "inline-block", margin: "0 auto" }}>
                <img src="https://erp.eatanytime.in/eat_erp/assets/invoice/logo.png" alt="" style={{ verticalAlign: "top", marginTop: 0, width: 150 }} />
                <p style={{ fontSize: 12, lineHeight: 18, margin: 0, marginBottom: 10 }}>REG. ADDRESS<br />Unit no 30,31,35,36,37 Samhita Complex, 13, Off Andheri-Kurla, Andheri East, Mumbai 400072 Maharashtra India<br />+91 8268000456<br /><a href="mailto:cs@eatanytime.in">cs@eatanytime.in</a>{/* GSTIN: 27AABCW7811R1ZN */}</p>
            </center>
            <table
                cellSpacing={0}
                cellPadding={5}
                border={1}
                style={{ borderCollapse: "collapse", width: "100%", margin: "auto", fontFamily:"Arcon-Regular, OpenSans-Regular, Arcon, Verdana, Geneva, sans-serif", fontSize: 8, fontWeight: 400, border: "1px solid #666" }}
            >
                <colgroup> 
                <col width={43} />
                <col width={115} />
                <col width={110} />
                <col width={112} />
                <col width={83} />
                <col width={92} />
                <col width={95} />
                <col width={64} />
                </colgroup>
                <tbody>
                <tr>
                    <td colSpan={6} align="left"
                    valign="top"
                    style={{ padding: 0, borderSpacing: 0 }}
                    >
                    <table width="100%" border={0} style={{ borderSpacing: 0 }}>
                        <tbody>
                        <tr>
                            <td
                            width="60%"
                            style={{
                                color: "#808080",
                                margin: "0 auto",
                                textAlign: "center"
                            }}
                            >
                            <h1 style={{ padding: 0, margin: 0, fontSize: 20 }}>
                                Tax Invoice
                            </h1>
                            </td>
                            {/* <td width="2%">
                                <table style="width:115%;border-collapse: collapse;height: 30px;border-spacing: 0;">
                                    <tr><td style="border: 1px solid #666;width:100%;border-top:none;border-right:none;border-bottom:none;">&nbsp;&nbsp;&nbsp;&nbsp;<span class="fa fa-check"></span><td></tr>
                                    <tr><td style="border: 1px solid #666;width:100%;border-right:none;">&nbsp;<td></tr>
                                    <tr><td style="border: 1px solid #666;width:100%;border-bottom:none;border-right:none;border-top:none;">&nbsp;<td></tr>
                                </table>
                            </td>
                            <td width="20%">
                                <table style="width:101%;border-collapse: collapse;height: 30px;border-spacing: 0;">
                                    <tr><td style="border:1px solid #666;width:100%;border-top:none;border-right:none;border-bottom:none;">Accounts<td></tr>
                                    <tr><td style="border:1px solid #666;width:100%;border-right:none;">Retailer<td></tr>
                                    <tr><td style="border:1px solid #666;width:100%;border-bottom:none;border-right:none;border-top:none;">Acknowledgement<td></tr>
                                </table>
                            </td> */}
                            <td width="22%">
                            <table
                                style={{
                                width: "101%",
                                borderCollapse: "collapse",
                                height: 30,
                                borderSpacing: 0
                                }}
                            >
                                <tbody>
                                <tr>
                                    <td
                                    style={{
                                        border: "1px solid #666",
                                        width: "20%",
                                        borderTop: "none",
                                        borderRight: "none",
                                        borderBottom: "none"
                                    }}
                                    >
                                    &nbsp;&nbsp;&nbsp;&nbsp;
                                    <span className="fa fa-check" />
                                    </td>
                                    <td></td>
                                    <td
                                    style={{
                                        border: "1px solid #666",
                                        width: "80%",
                                        borderTop: "none",
                                        borderRight: "none",
                                        borderBottom: "none"
                                    }}
                                    >
                                    Accounts
                                    </td>
                                    <td></td>
                                </tr>
                                <tr>
                                    <td
                                    style={{
                                        border: "1px solid #666",
                                        width: "20%",
                                        borderRight: "none"
                                    }}
                                    >
                                    &nbsp;
                                    </td>
                                    <td></td>
                                    <td
                                    style={{
                                        border: "1px solid #666",
                                        width: "80%",
                                        borderRight: "none"
                                    }}
                                    >
                                    Retailer
                                    </td>
                                    <td></td>
                                </tr>
                                <tr>
                                    <td
                                    style={{
                                        border: "1px solid #666",
                                        width: "20%",
                                        borderBottom: "none",
                                        borderRight: "none",
                                        borderTop: "none"
                                    }}
                                    >
                                    &nbsp;
                                    </td>
                                    <td></td>
                                    <td
                                    style={{
                                        border: "1px solid #666",
                                        width: "80%",
                                        borderBottom: "none",
                                        borderRight: "none",
                                        borderTop: "none"
                                    }}
                                    >
                                    Acknowledgement
                                    </td>
                                    <td></td>
                                </tr>
                                </tbody>
                            </table>
                            </td>
                        </tr>
                        </tbody>
                    </table>
                    </td>
                </tr>
                <tr>
                    <td colSpan={6} valign="top" style={{ lineHeight: 12, padding: 0 }}>
                    <table
                        width="100%"
                        border={0}
                        cellSpacing={0}
                        cellPadding={2}
                        style={{ borderCollapse: "collapse" }}
                    >
                        <tbody>
                        <tr style={{ borderBottom: "0px solid #666", height: 30 }}>
                            <td
                            width="50%"
                            rowSpan={3}
                            style={{ lineHeight: 12, borderBottom: "0px solid #666" }}
                            >
                            <table
                                width="100%"
                                border={0}
                                cellSpacing={0}
                                cellPadding={2}
                                style={{ borderCollapse: "collapse" }}
                            >
                                <tbody>
                                <tr>
                                    <td width="20%">Reverse Charge:</td>
                                    <td width="20%">No</td>
                                    <td width="20%">Shipped From:</td>
                                    <td width="40%" rowSpan={2}>
                                    Unit no 30,31,35,36,37 Samhita Complex, 13, Off
                                    Andheri-Kurla, Andheri East, Mumbai 400072
                                    Maharashtra, India
                                    </td>
                                </tr>
                                <tr>
                                    <td>Invoice No: </td>
                                    <td>W/24-25/626539</td>
                                </tr>
                                <tr>
                                    <td>Invoice Date: </td>
                                    <td>07-Dec-24</td>
                                    <td>GST No:</td>
                                    <td>27AABCW7811R1ZN</td>
                                </tr>
                                <tr>
                                    <td>State: </td>
                                    <td>Maharashtra </td>
                                    <td>State Code:</td>
                                    <td>
                                    27{" "}
                                    {/* <table style="float: right;border-collapse:collapse;margin-right:10px;">
                                                <tr style="border-top:1px solid #666;">
                                                    <td style="border-left:1px solid #666;border-right:1px solid #666;width:80px;" align="right">State Code: &nbsp;</td>
                                                    <td style="border-right:1px solid #666;width:20px;text-align:center;"></td>
                                                </tr>
                                            </table> */}
                                    </td>
                                </tr>
                                </tbody>
                            </table>
                            </td>
                            <td
                            width="50%"
                            valign="top"
                            style={{
                                lineHeight: 12,
                                borderRight: "none",
                                borderLeft: "1px solid #666",
                                borderBottom: "1px solid #666"
                            }}
                            >
                            <table
                                width="100%"
                                border={0}
                                cellSpacing={0}
                                cellPadding={2}
                                style={{ borderCollapse: "collapse" }}
                            >
                                <tbody>
                                <tr>
                                    <td width="25%">Transporter Mode:</td>
                                    <td />
                                </tr>
                                <tr>
                                    <td>PO Number: </td>
                                    <td>SHOP4007798-O1</td>
                                </tr>
                                <tr>
                                    <td>Date of Supply: </td>
                                    <td />
                                </tr>
                                <tr>
                                    <td>Place of Supply: </td>
                                    <td>Maharashtra</td>
                                </tr>
                                </tbody>
                            </table>
                            </td>
                        </tr>
                        </tbody>
                    </table>
                    </td>
                </tr>
                <tr>
                    <td colSpan={6} />
                </tr>
                <tr>
                    <td
                    colSpan={6}
                    valign="top"
                    style={{ lineHeight: 12, padding: 0, borderBottom: "none" }}
                    >
                    <table
                        width="100%"
                        border={0}
                        cellSpacing={0}
                        cellPadding={2}
                        style={{ borderCollapse: "collapse" }}
                    >
                        <tbody>
                        <tr style={{ borderBottom: "0px solid #666", height: 20 }}>
                            <td
                            width="50%"
                            rowSpan={3}
                            style={{
                                lineHeight: 12,
                                borderBottom: "0px solid #666",
                                textAlign: "center",
                                borderRight: "1px solid #666",
                                fontWeight: "bolder"
                            }}
                            >
                            Details of Receiver | Billed to:
                            </td>
                            <td
                            width="50%"
                            rowSpan={3}
                            style={{
                                lineHeight: 12,
                                borderBottom: "0px solid #666",
                                textAlign: "center",
                                fontWeight: "bolder"
                            }}
                            >
                            Details of Consignee | Shipped to:
                            </td>
                        </tr>
                        </tbody>
                    </table>
                    </td>
                </tr>
                <tr>
                    <td
                    colSpan={6}
                    valign="top"
                    style={{ lineHeight: 12, padding: 0, borderBottom: "none" }}
                    >
                    <table
                        width="100%"
                        border={0}
                        cellSpacing={0}
                        cellPadding={2}
                        style={{ borderCollapse: "collapse" }}
                    >
                        <tbody>
                        <tr style={{ borderBottom: "0px solid #666", height: 30 }}>
                            <td
                            width="50%"
                            rowSpan={3}
                            style={{ lineHeight: 12, borderBottom: "0px solid #666" }}
                            >
                            <table
                                width="100%"
                                border={0}
                                cellSpacing={0}
                                cellPadding={2}
                                style={{ borderCollapse: "collapse" }}
                            >
                                <tbody>
                                <tr>
                                    <td width="20%">Name:</td>
                                    <td colSpan={3}>ANANTHI S</td>
                                </tr>
                                <tr>
                                    <td>Address: </td>
                                    <td colSpan={3}>
                                    Dummy, Tirunelvelli 627007 Tamil Nadu, India
                                    </td>
                                </tr>
                                <tr>
                                    <td>GSTIN: </td>
                                    <td colSpan={3} />
                                </tr>
                                <tr style={{}}>
                                    <td>Mobile No: </td>
                                    <td colSpan={3}>1234567890</td>
                                </tr>
                                <tr>
                                    <td>State: </td>
                                    <td width="20%">Tamil Nadu</td>
                                    <td width="20%">State Code: &nbsp;</td>
                                    <td width="40%">33</td>
                                </tr>
                                </tbody>
                            </table>
                            </td>
                            <td
                            width="50%"
                            valign="top"
                            style={{
                                lineHeight: 12,
                                borderRight: "none",
                                borderLeft: "1px solid #666",
                                borderBottom: "1px solid #666"
                            }}
                            >
                            <table
                                width="100%"
                                border={0}
                                cellSpacing={0}
                                cellPadding={2}
                                style={{ borderCollapse: "collapse" }}
                            >
                                <tbody>
                                <tr>
                                    <td width="20%">Name:</td>
                                    <td colSpan={3}>ANANTHI S</td>
                                </tr>
                                <tr>
                                    <td>Address: </td>
                                    <td colSpan={3}>
                                    Dummy, Tirunelvelli 627007 Tamil Nadu, India
                                    </td>
                                </tr>
                                <tr>
                                    <td>GSTIN: </td>
                                    <td colSpan={3} />
                                </tr>
                                <tr style={{}}>
                                    <td>Mobile No: </td>
                                    <td colSpan={3}>1234567890</td>
                                </tr>
                                <tr>
                                    <td>State: </td>
                                    <td width="20%">Tamil Nadu</td>
                                    <td width="20%">State Code: &nbsp;</td>
                                    <td width="40%">33</td>
                                </tr>
                                {/* <tr>
                                        <td>State: </td>
                                        <td>                                        <table style="float: right;border-collapse:collapse;margin-right:10px;">
                                                <tr style="border-top:1px solid #666;">
                                                    <td style="border-left:1px solid #666;border-right:1px solid #666;width:80px;" align="right">State Code: &nbsp;</td>
                                                    <td style="border-right:1px solid #666;width:20px;text-align:center;"></td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr> */}
                                </tbody>
                            </table>
                            </td>
                        </tr>
                        </tbody>
                    </table>
                    </td>
                </tr>
                <tr>
                    <td colSpan={6}>&nbsp;</td>
                </tr>
                <tr style={{ fontSize: 8, fontWeight: 500 }}>
                    <td colSpan={6} style={{ padding: 0 }}>
                    <table
                        style={{ width: "100%" }}
                        width="100%"
                        border={0}
                        cellSpacing={0}
                        cellPadding={2}
                    >
                        <tbody>
                        <tr style={{ background: "#ececec" }}>
                            <td
                            width={20}
                            align="center"
                            valign="middle"
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "1px solid #666"
                            }}
                            >
                            Sr No.
                            </td>
                            <td
                            width={550}
                            align="center"
                            valign="middle"
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "1px solid #666"
                            }}
                            >
                            Name of Product / Service
                            </td>
                            <td
                            width={40}
                            align="center"
                            valign="middle"
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "1px solid #666"
                            }}
                            >
                            HSN ACS
                            </td>
                            <td
                            width={40}
                            align="center"
                            valign="middle"
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "1px solid #666"
                            }}
                            >
                            UOM
                            </td>
                            <td
                            width={60}
                            align="center"
                            valign="middle"
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "1px solid #666"
                            }}
                            >
                            Qty
                            </td>
                            <td
                            width={60}
                            align="center"
                            valign="middle"
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "1px solid #666"
                            }}
                            >
                            MRP
                            </td>
                            <td
                            width={60}
                            align="center"
                            valign="middle"
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "1px solid #666"
                            }}
                            >
                            Rate
                            </td>
                            <td
                            width={60}
                            align="center"
                            valign="middle"
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "1px solid #666"
                            }}
                            >
                            &nbsp;Amount&nbsp;
                            </td>
                            <td
                            width={60}
                            align="center"
                            valign="middle"
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "1px solid #666"
                            }}
                            >
                            Less Discount
                            </td>
                            <td
                            width={60}
                            align="center"
                            valign="middle"
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "1px solid #666"
                            }}
                            >
                            Taxable Value
                            </td>
                            <td
                            width={150}
                            align="center"
                            valign="middle"
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "1px solid #666",
                                padding: 0
                            }}
                            >
                            <table
                                style={{ width: "100%", borderSpacing: 0, height: 36 }}
                            >
                                <tbody>
                                <tr>
                                    <td colSpan={2} style={{ textAlign: "center" }}>
                                    CGST
                                    </td>
                                </tr>
                                <tr>
                                    <td
                                    style={{
                                        borderRight: "1px solid #666",
                                        borderBottom: "0px solid #666",
                                        borderTop: "1px solid #666",
                                        textAlign: "center"
                                    }}
                                    width="50%"
                                    >
                                    Rate
                                    </td>
                                    <td
                                    style={{
                                        borderRight: "0px solid #666",
                                        borderBottom: "0px solid #666",
                                        borderTop: "1px solid #666",
                                        textAlign: "center"
                                    }}
                                    width="50%"
                                    >
                                    Amount
                                    </td>
                                </tr>
                                </tbody>
                            </table>
                            </td>
                            <td
                            width={150}
                            align="center"
                            valign="middle"
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "1px solid #666",
                                padding: 0
                            }}
                            >
                            <table
                                style={{ width: "100%", borderSpacing: 0, height: 36 }}
                            >
                                <tbody>
                                <tr>
                                    <td colSpan={2} style={{ textAlign: "center" }}>
                                    SGST
                                    </td>
                                </tr>
                                <tr>
                                    <td
                                    style={{
                                        borderRight: "1px solid #666",
                                        borderBottom: "0px solid #666",
                                        borderTop: "1px solid #666",
                                        textAlign: "center"
                                    }}
                                    width="50%"
                                    >
                                    Rate
                                    </td>
                                    <td
                                    style={{
                                        borderRight: "0px solid #666",
                                        borderBottom: "0px solid #666",
                                        borderTop: "1px solid #666",
                                        textAlign: "center"
                                    }}
                                    width="50%"
                                    >
                                    Amount
                                    </td>
                                </tr>
                                </tbody>
                            </table>
                            </td>
                            <td
                            width={150}
                            align="center"
                            valign="middle"
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "1px solid #666",
                                padding: 0
                            }}
                            >
                            <table
                                style={{ width: "100%", borderSpacing: 0, height: 36 }}
                            >
                                <tbody>
                                <tr>
                                    <td colSpan={2} style={{ textAlign: "center" }}>
                                    IGST
                                    </td>
                                </tr>
                                <tr>
                                    <td
                                    style={{
                                        borderRight: "1px solid #666",
                                        borderBottom: "0px solid #666",
                                        borderTop: "1px solid #666",
                                        textAlign: "center"
                                    }}
                                    width="50%"
                                    >
                                    Rate
                                    </td>
                                    <td
                                    style={{
                                        borderRight: "0px solid #666",
                                        borderBottom: "0px solid #666",
                                        borderTop: "1px solid #666",
                                        textAlign: "center"
                                    }}
                                    width="50%"
                                    >
                                    Amount
                                    </td>
                                </tr>
                                </tbody>
                            </table>
                            </td>
                            <td
                            width={60}
                            align="center"
                            valign="middle"
                            style={{
                                borderRight: "none",
                                borderBottom: "1px solid #666"
                            }}
                            >
                            Total
                            </td>
                        </tr>
                        <tr valign="top" style={{ border: "none" }}>
                            <td
                            valign="top"
                            align="center"
                            style={{
                                borderLeft: "1px solid #666",
                                borderTop: "none",
                                borderBottom: "none",
                                border: "none",
                                borderRight: "1px solid #666"
                            }}
                            >
                            1
                            </td>
                            <td
                            valign="top"
                            align="left"
                            style={{
                                borderLeft: "1px solid #666",
                                borderTop: "none",
                                borderBottom: "none",
                                border: "none",
                                borderRight: "1px solid #666"
                            }}
                            >
                            Pink Salt - 200 Grams
                            </td>
                            <td
                            width={130}
                            valign="top"
                            align="right"
                            style={{
                                borderLeft: "1px solid #666",
                                borderTop: "none",
                                borderBottom: "none",
                                border: "none",
                                borderRight: "1px solid #666"
                            }}
                            >
                            <p style={{ margin: 0 }}>25010020</p>
                            </td>
                            <td
                            width={130}
                            valign="top"
                            align="right"
                            style={{
                                borderLeft: "1px solid #666",
                                borderTop: "none",
                                borderBottom: "none",
                                border: "none",
                                borderRight: "1px solid #666"
                            }}
                            >
                            <p style={{ margin: 0 }}>200gm</p>
                            </td>
                            <td
                            valign="top"
                            align="right"
                            style={{
                                borderLeft: "1px solid #666",
                                borderTop: "none",
                                borderBottom: "none",
                                border: "none",
                                borderRight: "1px solid #666"
                            }}
                            >
                            <p style={{ margin: 0 }}>1</p>
                            </td>
                            <td
                            valign="top"
                            align="right"
                            style={{
                                borderLeft: "1px solid #666",
                                borderTop: "none",
                                borderBottom: "none",
                                border: "none",
                                borderRight: "1px solid #666"
                            }}
                            >
                            <p style={{ margin: 0 }}>250</p>
                            </td>
                            <td
                            valign="top"
                            align="right"
                            style={{
                                borderLeft: "1px solid #666",
                                borderTop: "none",
                                borderBottom: "none",
                                border: "none",
                                borderRight: "1px solid #666"
                            }}
                            >
                            <p style={{ margin: 0 }}>57.55</p>
                            </td>
                            <td
                            valign="top"
                            align="right"
                            style={{
                                borderLeft: "1px solid #666",
                                borderTop: "none",
                                borderBottom: "none",
                                border: "none",
                                borderRight: "1px solid #666"
                            }}
                            >
                            <p style={{ margin: 0 }}>57.55</p>
                            </td>
                            <td
                            valign="top"
                            align="right"
                            style={{
                                borderLeft: "1px solid #666",
                                borderTop: "none",
                                borderBottom: "none",
                                border: "none",
                                borderRight: "1px solid #666"
                            }}
                            >
                            <p style={{ margin: 0 }}>0</p>
                            </td>
                            <td
                            valign="top"
                            align="right"
                            style={{
                                borderLeft: "1px solid #666",
                                borderTop: "none",
                                borderBottom: "none",
                                border: "none",
                                borderRight: "1px solid #666"
                            }}
                            >
                            <p style={{ margin: 0 }}>57.55</p>
                            </td>
                            <td
                            align="center"
                            valign="middle"
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "0px solid #666",
                                padding: 0
                            }}
                            >
                            <table
                                style={{ width: "100%", borderSpacing: 0, height: 17 }}
                            >
                                <tbody>
                                <tr>
                                    <td
                                    style={{
                                        borderRight: "1px solid #666",
                                        borderBottom: "0px solid #666",
                                        borderTop: "0px solid #666",
                                        textAlign: "right"
                                    }}
                                    width="50%"
                                    >
                                    0
                                    </td>
                                    <td
                                    style={{
                                        borderRight: "0px solid #666",
                                        borderBottom: "0px solid #666",
                                        borderTop: "0px solid #666",
                                        textAlign: "right"
                                    }}
                                    width="50%"
                                    >
                                    0
                                    </td>
                                </tr>
                                </tbody>
                            </table>
                            </td>
                            <td
                            align="center"
                            valign="middle"
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "0px solid #666",
                                padding: 0
                            }}
                            >
                            <table
                                style={{ width: "100%", borderSpacing: 0, height: 17 }}
                            >
                                <tbody>
                                <tr>
                                    <td
                                    style={{
                                        borderRight: "1px solid #666",
                                        borderBottom: "0px solid #666",
                                        borderTop: "0px solid #666",
                                        textAlign: "right"
                                    }}
                                    width="50%"
                                    >
                                    0
                                    </td>
                                    <td
                                    style={{
                                        borderRight: "0px solid #666",
                                        borderBottom: "0px solid #666",
                                        borderTop: "0px solid #666",
                                        textAlign: "right"
                                    }}
                                    width="50%"
                                    >
                                    0
                                    </td>
                                </tr>
                                </tbody>
                            </table>
                            </td>
                            <td
                            align="center"
                            valign="middle"
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "0px solid #666",
                                padding: 0
                            }}
                            >
                            <table
                                style={{ width: "100%", borderSpacing: 0, height: 17 }}
                            >
                                <tbody>
                                <tr>
                                    <td
                                    style={{
                                        borderRight: "1px solid #666",
                                        borderBottom: "0px solid #666",
                                        borderTop: "0px solid #666",
                                        textAlign: "right"
                                    }}
                                    width="50%"
                                    >
                                    0
                                    </td>
                                    <td
                                    style={{
                                        borderRight: "0px solid #666",
                                        borderBottom: "0px solid #666",
                                        borderTop: "0px solid #666",
                                        textAlign: "right"
                                    }}
                                    width="50%"
                                    >
                                    0
                                    </td>
                                </tr>
                                </tbody>
                            </table>
                            </td>
                            <td
                            valign="top"
                            align="right"
                            style={{
                                borderLeft: "1px solid #666",
                                borderTop: "none",
                                borderBottom: "none",
                                border: "none"
                            }}
                            >
                            <p style={{ margin: 0 }}>57.55</p>
                            </td>
                        </tr>
                        </tbody>
                    </table>
                    </td>
                </tr>
                <tr>
                    <td colSpan={6} />
                </tr>
                <tr style={{ borderTop: "1px solid #666" }}>
                    <td
                    colSpan={4}
                    rowSpan={4}
                    valign="top"
                    style={{ padding: 0, width: "50%" }}
                    >
                    <p style={{ margin: "5px 5px", fontSize: 15, lineHeight: 18 }}>
                        <span style={{ marginBottom: 5, display: "none" }}>Products: </span>
                        <span style={{ display: "block" }}>
                        Amount in words: Fifty Eight Rupees Only{" "}
                        </span>
                    </p>
                    </td>
                    <td
                    colSpan={1}
                    valign="top"
                    style={{ fontSize: 10, fontWeight: 900, background: "#ececec" }}
                    >
                    Total amount before Tax <br />
                    </td>
                    <td style={{ fontSize: 10, fontWeight: 900, background: "#ececec" }}>
                    &nbsp;
                    <span style={{ textAlign: "left", float: "left" }}> ₹&nbsp;</span>
                    &nbsp;
                    <span style={{ textAlign: "right", float: "right" }}>57.55</span>
                    </td>
                </tr>
                <tr>
                    <td colSpan={1} valign="top" style={{ fontSize: 10, fontWeight: 500 }}>
                    Add: CGST
                    </td>
                    <td style={{ fontSize: 10, fontWeight: 500 }}>
                    &nbsp;
                    <span style={{ textAlign: "left", float: "left" }}> ₹&nbsp;</span>
                    &nbsp;
                    <span style={{ textAlign: "right", float: "right" }}>0</span>
                    </td>
                </tr>
                <tr>
                    <td colSpan={1} valign="top" style={{ fontSize: 10, fontWeight: 500 }}>
                    Add: SGST
                    </td>
                    <td style={{ fontSize: 10, fontWeight: 500 }}>
                    &nbsp;
                    <span style={{ textAlign: "left", float: "left" }}> ₹&nbsp;</span>
                    &nbsp;
                    <span style={{ textAlign: "right", float: "right" }}>0</span>
                    </td>
                </tr>
                <tr>
                    <td colSpan={1} valign="top" style={{ fontSize: 10, fontWeight: 500 }}>
                    Add: IGST
                    </td>
                    <td style={{ fontSize: 10, fontWeight: 500 }}>
                    &nbsp;
                    <span style={{ textAlign: "left", float: "left" }}> ₹&nbsp;</span>
                    &nbsp;
                    <span style={{ textAlign: "right", float: "right" }}>0</span>
                    </td>
                </tr>
                <tr style={{ fontSize: 10 }}>
                    <td
                    width={840}
                    colSpan={4}
                    rowSpan={4}
                    align="center"
                    valign="middle"
                    style={{
                        borderRight: "1px solid #666",
                        borderBottom: "1px solid #666",
                        padding: 0
                    }}
                    >
                    <table
                        style={{
                        width: "100%",
                        borderSpacing: 0,
                        height: 83,
                        minHeight: 83
                        }}
                    >
                        <tbody>
                        <tr>
                            <td
                            colSpan={2}
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "0px solid #666",
                                textAlign: "center",
                                fontWeight: 900,
                                background: "#ececec"
                            }}
                            >
                            CGST
                            </td>
                            <td
                            colSpan={2}
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "0px solid #666",
                                textAlign: "center",
                                fontWeight: 900,
                                background: "#ececec"
                            }}
                            >
                            SGST
                            </td>
                            <td
                            colSpan={2}
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "0px solid #666",
                                textAlign: "center",
                                fontWeight: 900,
                                background: "#ececec"
                            }}
                            >
                            IGST
                            </td>
                            <td
                            rowSpan={2}
                            style={{
                                height: 25,
                                verticalAlign: "middle",
                                background: "#ececec",
                                fontWeight: 900,
                                textAlign: "center"
                            }}
                            >
                            Total Tax Value
                            </td>
                        </tr>
                        <tr style={{ fontWeight: 900, background: "#ececec" }}>
                            <td
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "0px solid #666",
                                borderTop: "1px solid #666",
                                textAlign: "center"
                            }}
                            width="15%"
                            >
                            Rate
                            </td>
                            <td
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "0px solid #666",
                                borderTop: "1px solid #666",
                                textAlign: "center"
                            }}
                            width="15%"
                            >
                            Amount
                            </td>
                            <td
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "0px solid #666",
                                borderTop: "1px solid #666",
                                textAlign: "center"
                            }}
                            width="15%"
                            >
                            Rate
                            </td>
                            <td
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "0px solid #666",
                                borderTop: "1px solid #666",
                                textAlign: "center"
                            }}
                            width="15%"
                            >
                            Amount
                            </td>
                            <td
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "0px solid #666",
                                borderTop: "1px solid #666",
                                textAlign: "center"
                            }}
                            width="15%"
                            >
                            Rate
                            </td>
                            <td
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "0px solid #666",
                                borderTop: "1px solid #666",
                                textAlign: "center"
                            }}
                            width="10%"
                            >
                            Amount
                            </td>
                        </tr>
                        <tr>
                            <td
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "0px solid #666",
                                borderTop: "1px solid #666",
                                textAlign: "center"
                            }}
                            width="15%"
                            >
                            0
                            </td>
                            <td
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "0px solid #666",
                                borderTop: "1px solid #666",
                                textAlign: "center"
                            }}
                            width="15%"
                            >
                            0.00
                            </td>
                            <td
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "0px solid #666",
                                borderTop: "1px solid #666",
                                textAlign: "center"
                            }}
                            width="15%"
                            >
                            0
                            </td>
                            <td
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "0px solid #666",
                                borderTop: "1px solid #666",
                                textAlign: "center"
                            }}
                            width="15%"
                            >
                            0.00
                            </td>
                            <td
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "0px solid #666",
                                borderTop: "1px solid #666",
                                textAlign: "center"
                            }}
                            width="15%"
                            >
                            0
                            </td>
                            <td
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "0px solid #666",
                                borderTop: "1px solid #666",
                                textAlign: "center"
                            }}
                            width="15%"
                            >
                            0.00
                            </td>
                            <td
                            style={{
                                borderRight: "0px solid #666",
                                borderBottom: "0px solid #666",
                                borderTop: "1px solid #666",
                                textAlign: "center"
                            }}
                            width="10%"
                            >
                            0
                            </td>
                        </tr>
                        <tr style={{ fontWeight: 900, background: "#ececec" }}>
                            <td
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "0px solid #666",
                                borderTop: "1px solid #666",
                                textAlign: "center"
                            }}
                            width="15%"
                            >
                            Total
                            </td>
                            <td
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "0px solid #666",
                                borderTop: "1px solid #666",
                                textAlign: "center"
                            }}
                            width="15%"
                            >
                            {" "}
                            ₹ &nbsp; 0
                            </td>
                            <td
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "0px solid #666",
                                borderTop: "1px solid #666",
                                textAlign: "center"
                            }}
                            width="15%"
                            >
                            Total
                            </td>
                            <td
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "0px solid #666",
                                borderTop: "1px solid #666",
                                textAlign: "center"
                            }}
                            width="15%"
                            >
                            {" "}
                            ₹ &nbsp; 0
                            </td>
                            <td
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "0px solid #666",
                                borderTop: "1px solid #666",
                                textAlign: "center"
                            }}
                            width="15%"
                            >
                            Total
                            </td>
                            <td
                            style={{
                                borderRight: "1px solid #666",
                                borderBottom: "0px solid #666",
                                borderTop: "1px solid #666",
                                textAlign: "center"
                            }}
                            width="15%"
                            >
                            {" "}
                            ₹ &nbsp; 0
                            </td>
                            <td
                            style={{
                                borderRight: "0px solid #666",
                                borderBottom: "0px solid #666",
                                borderTop: "1px solid #666",
                                textAlign: "center"
                            }}
                            width="10%"
                            >
                            {" "}
                            ₹ &nbsp; 0
                            </td>
                        </tr>
                        </tbody>
                    </table>
                    </td>{" "}
                    <td
                    colSpan={1}
                    valign="middle"
                    style={{ fontSize: 10, fontWeight: 900, background: "#ececec" }}
                    >
                    <p style={{ margin: 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 900 }}>
                        Total Amount: GST
                        </span>
                    </p>
                    </td>
                    <td style={{ fontSize: 10, fontWeight: 900, background: "#ececec" }}>
                    &nbsp;
                    <span style={{ textAlign: "left", float: "left" }}> ₹&nbsp;</span>
                    &nbsp;
                    <span style={{ textAlign: "right", float: "right" }}>0</span>
                    </td>
                </tr>
                <tr>
                    <td colSpan={1} valign="top" style={{ fontSize: 10, fontWeight: 500 }}>
                    Shipping Amount
                    </td>
                    <td style={{ fontSize: 10, fontWeight: 500 }}>
                    &nbsp;
                    <span style={{ textAlign: "left", float: "left" }}> ₹&nbsp;</span>
                    &nbsp;
                    <span style={{ textAlign: "right", float: "right" }}>0</span>
                    </td>
                </tr>
                <tr>
                    <td colSpan={1} valign="top" style={{ fontSize: 10, fontWeight: 500 }}>
                    Round Off Amount
                    </td>
                    <td style={{ fontSize: 10, fontWeight: 500 }}>
                    &nbsp;
                    <span style={{ textAlign: "left", float: "left" }}> ₹&nbsp;</span>
                    &nbsp;
                    <span style={{ textAlign: "right", float: "right" }}>0.45</span>
                    </td>
                </tr>
                <tr style={{ background: "#ececec" }}>
                    <td
                    colSpan={1}
                    valign="middle"
                    style={{ fontSize: 10, fontWeight: 900 }}
                    >
                    <p style={{ margin: 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 900 }}>
                        Total Amount After Tax
                        </span>
                    </p>
                    </td>
                    <td style={{ fontSize: 10, fontWeight: 900 }}>
                    &nbsp;
                    <span style={{ textAlign: "left", float: "left" }}> ₹&nbsp;</span>
                    &nbsp;
                    <span style={{ textAlign: "right", float: "right" }}>58</span>
                    </td>
                </tr>
                <tr>
                    <td
                    colSpan={4}
                    valign="middle"
                    style={{ fontSize: 10, fontWeight: 900 }}
                    >
                    <p style={{ margin: 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 900 }}>
                        {" "}
                        Total weight in Kg :- 0.2Kg
                        </span>
                    </p>
                    </td>
                    <td
                    colSpan={1}
                    valign="middle"
                    style={{ fontSize: 10, fontWeight: 900 }}
                    >
                    <p style={{ margin: 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 900 }}>
                        GST Payable on Reverse Charge
                        </span>
                    </p>
                    </td>
                    <td style={{ fontSize: 10, fontWeight: 900, background: "#ececec" }}>
                    &nbsp;
                    <span style={{ textAlign: "left", float: "left" }}> ₹&nbsp;</span>
                    &nbsp;
                    <span style={{ textAlign: "right", float: "right" }}>0</span>
                    </td>
                </tr>
                <tr>
                    <td colSpan={4} valign="middle" style={{ padding: 0 }}>
                    <table width="100%" border={0} cellPadding={5} cellSpacing={0}>
                        <tbody>
                        <tr>
                            <td width="42%">
                            <p style={{ margin: 0 }}>
                                <span style={{ fontSize: 8, fontWeight: 500 }}>
                                Bank Name{" "}
                                </span>
                            </p>
                            </td>
                            <td width="58%">
                            <span style={{ fontSize: 8, fontWeight: 500 }}>
                                : HDFC Bank{" "}
                            </span>
                            </td>
                        </tr>
                        <tr>
                            <td>
                            <p style={{ margin: 0 }}>
                                <span style={{ fontSize: 8, fontWeight: 500 }}>Branch</span>
                            </p>
                            </td>
                            <td>
                            <span style={{ fontSize: 8, fontWeight: 500 }}>
                                : Kandivali(w)
                            </span>
                            </td>
                        </tr>
                        <tr>
                            <td>
                            <p style={{ margin: 0 }}>
                                <span style={{ fontSize: 8, fontWeight: 500 }}>
                                A/C No.{" "}
                                </span>
                            </p>
                            </td>
                            <td>
                            <span style={{ fontSize: 8, fontWeight: 500 }}>
                                : 50200018195231
                            </span>
                            </td>
                        </tr>
                        <tr>
                            <td>
                            <p style={{ margin: 0 }}>
                                <span style={{ fontSize: 8, fontWeight: 500 }}>
                                {" "}
                                IFSC Code{" "}
                                </span>
                            </p>
                            </td>
                            <td>
                            <span style={{ fontSize: 8, fontWeight: 500 }}>
                                : HDFC0000288
                            </span>
                            </td>
                        </tr>
                        </tbody>
                    </table>
                    </td>
                    <td
                    colSpan={2}
                    align="center"
                    valign="top"
                    style={{ fontSize: 8, fontWeight: 500 }}
                    >
                    &nbsp;For Wholsome Habits Pvt Ltd <br />{" "}
                    <img
                        src="https://erp.eatanytime.in/eat_erp//assets/invoice/stamp.jpg"
                        height={50}
                        alt="Sign3 Rishit"
                    />{" "}
                    <br />
                    Authorised Signatory
                    </td>
                </tr>
                <tr>
                    <td colSpan={6} valign="top">
                    <p style={{ lineHeight: 11, textAlign: "justify", margin: 0 }}>
                        <span style={{ fontSize: 8, fontWeight: 500 }}>Declaration:</span>
                        <br />I /We hereby certify that Registration Certificate under
                        Maharashtra VAT Act 2002(Act No. IX of 2005) (as amended by
                        Maharashtra Ordinance no.1 of 2005 dated 09-03-2005) is in force on
                        the date on which the sale of goods specified in this bill/cash
                        Memorandum has been effected by Me/Us in the regular course of our
                        business. It shall be accounted for in the turnover of sales while
                        filing return and the due tax, if any Payable on the sales has been
                        paid or shall be paid. I /We hereby certify that Registration
                        Certificate under Maharashtra VAT Act 2002(Act No. IX of 2005) (as
                        amended by Maharashtra Ordinance no.1 of 2005 dated 09-03-2005) is
                        in force on the date on which the sale of goods specified in this
                        bill/cash Memorandum has been effected by Me/Us in the regular
                        course of our business. It shall be accounted for in the turnover of
                        sales while filing return and the due tax, if any Payable on the
                        sales has been paid or shall be paid.
                    </p>
                    </td>
                </tr>
                </tbody>
            </table>
            <p
                style={{
                textAlign: "center",
                fontFamily: "OpenSans-Regular, Arcon,Verdana, Geneva, sans-serif",
                fontSize: 8,
                lineHeight: 11,
                marginTop: 3,
                marginBottom: 0
                }}
            >
                SUBJECT TO MUMBAI JURISDICTION <br />
                This is a Computer Generated Invoice
            </p>
        </div>

  )
}

export default ViewPaymentUpload
