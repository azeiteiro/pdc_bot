import { oAuth2Client } from './googleAuth.js';
import { google, sheets_v4 } from 'googleapis';
import { loggers } from '../utils/logger.js';

let sheets: ReturnType<typeof google.sheets>;

(async () => {
  const authClient = await oAuth2Client;

  sheets = google.sheets({ version: 'v4', auth: authClient });
})();

const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
// Since we are appending, choose the beginning of the range
const range = 'Despesas!A2:E2';

export const getSheetData = async (): Promise<sheets_v4.Schema$ValueRange | undefined> => {
  if (!sheets) {
    throw new Error('Google Sheets API is not initialized.');
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Despesas!A2:E',
    });

    return response.data as sheets_v4.Schema$ValueRange;
  } catch (error) {
    loggers.errorWithContext(error as Error, 'Google Sheets API');
    throw error;
  }
};

// Append values to the Google Sheet
// This function takes an array of arrays (values) and appends them to the specified range
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

    return response.data;
  } catch (error) {
    loggers.errorWithContext(error as Error, 'Google Sheets API');
  }
};
