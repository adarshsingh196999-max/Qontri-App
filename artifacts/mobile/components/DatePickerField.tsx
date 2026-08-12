import { Platform } from "react-native";
import { DatePickerField as NativeDatePickerField } from "./DatePickerField.native";
import { DatePickerField as WebDatePickerField } from "./DatePickerField.web";

export const DatePickerField = Platform.OS === "web" ? WebDatePickerField : NativeDatePickerField;
