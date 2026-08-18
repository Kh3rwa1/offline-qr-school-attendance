# Academic Calendar & Working-Day Management

## Importance in Government-Ready Reporting

Accurate attendance percentage calculations require strict separation of actual instructional/session days from holidays, vacations, and emergency closures.

Under statutory school attendance rules:
- **Holidays must NEVER be counted as absences.**
- **Emergency school closures must NEVER penalize student attendance records.**
- **Working days are dynamically calculated based on the official school calendar.**

---

## 1. Calendar Day Classifications

The system supports the following day classifications:

1. **`WORKING_DAY`**: Standard instructional school day (`isWorkingDay = true`).
2. **`SUNDAY_WEEKEND`**: Weekly scheduled non-working day (`isWorkingDay = false`).
3. **`GOVERNMENT_HOLIDAY`**: State gazetted or central public holiday (`isWorkingDay = false`).
4. **`SCHOOL_HOLIDAY`**: Institutional holiday declared by the Managing Committee (`isWorkingDay = false`).
5. **`VACATION`**: Scheduled long break (Summer, Puja, Winter) (`isWorkingDay = false`).
6. **`EXAMINATION_DAY`**: Designated exam day (`isWorkingDay = true`).
7. **`EMERGENCY_CLOSURE`**: Unscheduled closure due to weather, natural disaster, or local administrative order (`isWorkingDay = false`).
8. **`OPTIONAL_WORKING_DAY`**: Special working Saturday or compensation day (`isWorkingDay = true`).

---

## 2. Default West Bengal Gazetted Holidays

The system includes pre-configured West Bengal gazetted holidays:

- **January 23**: Netaji Subhas Chandra Bose Jayanti
- **January 26**: Republic Day
- **February (Variable)**: Saraswati Puja / Vasant Panchami
- **March (Variable)**: Doljatra / Holi
- **April 14**: Dr. B.R. Ambedkar Jayanti / Poila Baisakh (Bengali New Year)
- **April (Variable)**: Good Friday
- **April / May (Variable)**: Eid-ul-Fitr
- **May 01**: May Day (Labour Day)
- **May 09**: Rabindra Jayanti
- **June / July (Variable)**: Eid-uz-Zoha (Bakrid)
- **July / August (Variable)**: Muharram
- **August 15**: Independence Day
- **September / October (Variable)**: Janmashtami / Fateha-Dwaz-Daham
- **October 02**: Mahatma Gandhi Jayanti
- **October / November (Variable)**: Mahalaya, Durga Puja (Maha Saptami through Vijaya Dashami), Lakshmi Puja, Kali Puja, Diwali, Bhatridwitiya (Bhai Dooj), Chhath Puja
- **November 15**: Birsa Munda Jayanti
- **November (Variable)**: Guru Nanak Jayanti
- **December 25**: Christmas Day

---

## 3. Bulk Vacation Setup

School Administrators can apply bulk date ranges for seasonal vacations:

```http
POST /api/v1/schools/{schoolId}/calendar/range
Content-Type: application/json

{
  "startDate": "2026-10-18",
  "endDate": "2026-10-25",
  "classification": "VACATION",
  "reason": "Durga Puja Vacation",
  "isWorkingDay": false
}
```

All dates in the specified range will be classified accordingly and excluded from student absence calculations.
