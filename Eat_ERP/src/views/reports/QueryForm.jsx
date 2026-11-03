import React, { useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx'; // Import xlsx library for generating Excel files

const QueryForm = () => {
  const [userQuery, setUserQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResults([]);

    try {
      const response = await axios.post('http://localhost:5000/api/query', {
        userQuery,
      });
      setResults(response.data);
    } catch (error) {
      setError('Error processing the query');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Function to handle exporting data to Excel
  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(results); // Convert results into Excel sheet
    const wb = XLSX.utils.book_new(); // Create a new workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Query Results'); // Append the sheet to the workbook

    // Generate the Excel file and prompt download
    XLSX.writeFile(wb, 'query_results.xlsx');
  };

  return (
    <div>
      <h2>Ask a Question in Natural Language</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Your Query:</label>
          <input
            type="text"
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder="e.g., Show me all employees over 30 years old"
            required
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Processing...' : 'Submit Query'}
        </button>
      </form>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {results.length > 0 && (
        <div>
          <h3>Results:</h3>
          <table>
            <thead>
              <tr>
                {Object.keys(results[0]).map((key) => (
                  <th key={key}>{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((row, idx) => (
                <tr key={idx}>
                  {Object.values(row).map((value, colIdx) => (
                    <td key={colIdx}>{value}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {/* Button to download Excel file */}
          <button onClick={exportToExcel}>Download Excel</button>
        </div>
      )}
    </div>
  );
};

export default QueryForm;
