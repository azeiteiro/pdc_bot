import { google } from 'googleapis';
import { getOauth } from './googleAuth.js';

let sheets: ReturnType<typeof google.sheets>;

(async () => {
  const auth = await getOauth();

  sheets = google.sheets({ version: 'v4', auth });
})();

const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
const range = 'Despesas!A2:E3';

export const getSheetInfo = () => {
  console.log('Fetching sheet info...');
  if (!sheets) {
    throw new Error('Google Sheets API is not initialized.');
  }
  sheets.spreadsheets.values
    .get({
      spreadsheetId,
      range,
    })
    .then((response) => {
      console.log('Sheet info fetched successfully.', response.data);
      const rows = response.data.values;

      if (rows?.length) {
        return rows.map((row) => row.join(', ')).join('\n');
      } else {
        return 'No data found.';
      }
    });
};

export const appendValuesToSheet = async (values: string[][]) => {
  try {
    const request = {
      spreadsheetId: spreadsheetId,
      range: range,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: values,
      },
    };

    const response = await sheets.spreadsheets.values.append(request);

    // console.log('Appended rows:', response.data.updates.updatedRows);

    return response.data;
  } catch (error) {
    console.error('Error appending to spreadsheet:', error);
    throw error;
  }
};
