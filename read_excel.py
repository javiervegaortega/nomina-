import pandas as pd
import json

file_path = r'C:\Users\jyaxo\Desktop\nomina-v2\nomina-\BONOS  ABRIL 2026.xlsx'
xls = pd.ExcelFile(file_path)

data = {}
for sheet in xls.sheet_names:
    df = pd.read_excel(file_path, sheet_name=sheet)
    data[sheet] = df.head(10).to_dict(orient='records')

with open('excel_data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
