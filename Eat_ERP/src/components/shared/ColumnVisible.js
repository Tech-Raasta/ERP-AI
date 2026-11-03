// import React, { useEffect, useState } from 'react'
// import { MultiSelect } from 'primereact/multiselect';
// import "./ColumnVisible.css"
// const ColumnVisible = (props) => {
//     const [selectedOption, setSelectedOption] = useState(null);
//     const [loading, setLoading] = useState(true);
//     const [options, setOptions] = useState([]);
//     useEffect(() => {
//         async function fetchData() {
//             let data = []
//             await props.table.getAllLeafColumns().map(column => {
//                 if (typeof column.columnDef.header !== "function") {
//                     data.push({ value: column.columnDef.header, code: column.id })
//                 }
//             })
//             setOptions(data)
//             setLoading(false);
//         }
//         fetchData()
//     }, [])

//     const changeHandler = (e) => {
//         setSelectedOption(e.value);
//         props.table.getAllLeafColumns().map(column => {
//             if (typeof column.columnDef.header != 'function') {
//                 if (e.value.indexOf(column.columnDef.header) !== -1) {
//                     column.toggleVisibility(false);
//                 } else {
//                     column.toggleVisibility(true);
//                 }
//             }
//         })
//     }

//     return (
//         <div className='py-2 w-full'>
//             <div className="card flex justify-content-center">
//                 <MultiSelect value={selectedOption} onChange={(e) => changeHandler(e)} options={options} optionLabel="value" display="chip"
//                     placeholder="Select option to be excluded" className="w-full md:w-20rem border mb-3 p-multiselect-sm" filter loading={loading} />
//             </div>
//         </div>
//     );
// }

// export default ColumnVisible
