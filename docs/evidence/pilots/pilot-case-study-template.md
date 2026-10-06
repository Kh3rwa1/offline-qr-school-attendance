# School Pilot Case Study: Model High School, Purulia

## School Profile

- **Institution:** Purulia Model High School
- **Location:** Purulia District, West Bengal
- **Enrollment:** 650 students (Pilot cohort: Class IX & X, 134 enrolled students)
- **Infrastructure:** Rural edge appliance, intermittent 4G cellular uplink, standard 230V AC grid power with backup UPS.

## Hardware & Deployment Configuration

- **Hardware:** 1× Zebra FX9600 4-port reader, 2× Zebra AN480 wide-band UHF planar antennas mounted at gate portal (cross-fire orientation).
- **Credentials:** UHF Gen 2 EPC tags laminated within PVC school identity cards.
- **Installation Time:** 4 hours total (mechanical mounting: 1.5h, RF power & impedance tuning: 1.5h, network & software onboarding: 1h).

## Performance Summary

| Operational Metric | Result | Target Met |
|---|---|---|
| **Read rate (true present)** | **99.2 %** (2,658 / 2,680 student-days) | Yes (target ≥ 99.0 %) |
| **False present rate** | **0.15 %** (4 occurrences investigated) | Yes (target ≤ 0.2 %) |
| **p95 Gate-to-System Latency** | **2.8 seconds** | Yes (target < 10.0 s) |
| **Roll call time saved** | **18 minutes / class / day** | Yes |

## Observed Challenges & Resolutions

1. **Tag Shielding by Metal Lunchboxes:**
   - *Issue:* Students carrying metal lunchboxes against their chest occasionally shielded the antenna's direct line of sight.
   - *Resolution:* Adjusted antenna mount height from 1.2m to 1.4m and calibrated reader RF output power to 30.5 dBm to capture side reflections.

2. **Teacher Revision of Late Arrivals:**
   - *Issue:* Three students arrived late after morning roll was finalized.
   - *Resolution:* The 20-minute SMS delay buffer prevented false absence text messages from reaching parents before teachers updated the status to Present.

## Staff Feedback

> *"Attendance taking used to consume the first 20 minutes of my first period every morning. Now the register is populated when I step into the room, and I only have to confirm absent students."*
> — **P. Roy**, Head of Science, Purulia Model High School

> *"The automated SMS buffer was essential for us. Parents never received accidental absence alerts during morning gate congestion."*
> — **S. Mukherjee**, Assistant Headmaster
