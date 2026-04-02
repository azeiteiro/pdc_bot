import { getOAuth2Client } from './googleAuth.js';
import { sheets as sheetsClient, sheets_v4 } from '@googleapis/sheets';
import { loggers } from '../utils/logger.js';

let sheetsInstance: sheets_v4.Sheets | null = null;

// Lazy initialization - only create sheets client when first needed
const getSheets = async (): Promise<sheets_v4.Sheets> => {
  if (!sheetsInstance) {
    const authClient = await getOAuth2Client();

    sheetsInstance = sheetsClient({ version: 'v4', auth: authClient });
  }

  return sheetsInstance;
};

const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
// Since we are appending, choose the beginning of the range
const range = 'Despesas!A2:E2';

export const getSheetData = async (): Promise<sheets_v4.Schema$ValueRange | undefined> => {
  try {
    const sheets = await getSheets();
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
    const sheets = await getSheets();
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
