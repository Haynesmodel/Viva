# Shotgun submissions reconciled November 20, 2026

This follow-up uses the November 12 ledger in
[PR #41](https://github.com/Haynesmodel/Viva/pull/41), commit
`b24d3da3d5c71fd75da522d310a810d407f4e4ba`. It accounts for all four submitted
originals. Three recordings have documented obligations; Kylie's is preserved
as unassigned rather than creating an unsupported obligation.

Recording dates use each MOV's embedded QuickTime recording-date metadata,
converted to America/Chicago (CST). Container creation timestamps can reflect
an export and are not used for deadline decisions. Contact sheets show one
Shotgun by the submitted owner in each recording.

| Owner / submitted clip | Recorded (CST) | Ledger outcome |
| --- | --- | --- |
| Kylie `IMG_3186.mov` | 2026-11-19 20:33:50 | Uploaded, unassigned. No open obligation in the November 12 ledger or Week 10 starter report. Commissioner clarification requested. |
| Wei `IMG_7856.mov` | 2026-11-19 18:38:56 | Completes Week 10 Jordan Addison (0 points), before the November 19 7:20 p.m. cutoff. |
| Joe `IMG_2650.mov` | 2026-11-18 21:56:09 | Completes Week 10 Omar Cooper Jr. (0 points), before the November 19 cutoff. The embedded source time is 20:56:09 at UTC−07:00. |
| Mino `IMG_5376.mov` | 2026-11-15 16:54:08 | Completes his oldest outstanding obligation, Week 9 George Pickens (0 points). Its November 12 cutoff was missed, so a Week 10 carryover remains owed. |

## Scoring and assignment evidence

The existing server-side ESPN adapter was run for the configured 2026 league,
Week 10, without changing Current Season. All 12 finalized team scores match
their starter sums within 0.01 points. Only bench (20) and injured reserve
(21) slots are excluded. The report identifies exactly four new score-based
obligations, all dated November 15 and due November 19:

| Owner | Started player | Points | Completion |
| --- | --- | ---: | --- |
| Leah | Patriots D/ST | −2 | Owed; no new Leah recording supplied. |
| Joe | Omar Cooper Jr. | 0 | `Joe/IMG_2650.mov` |
| Wei | Jordan Addison | 0 | `Wei/IMG_7856.mov` |
| Mino | David Montgomery | 0 | Owed; the single submitted Mino recording settles Week 9. |

Mino's existing Week 9 ID, date, due date, and cause are preserved; only its
completion and media reference change. His added Week 10 carryover is dated
November 12 and due November 19, with cause `Carryover: Week 9 George Pickens
missed Nov 12 deadline`. One clip receives one completion credit.

Kylie's prior completed recordings remain intact. Her new clip is not applied
to a future week, counted a second time against an already completed row, or
included in obligation totals. Its confirmed player/week or carryover is
needed before assignment. Follow the existing unassigned-recording procedure
documented in `SHOTGUN_SUBMISSIONS_2026-10-15.md`.

## Hosted originals

All four originals are stored in the existing Viva R2 bucket as
`video/quicktime`. No submitted file's MD5 matches any of the 151 previously
referenced media ETags, and all four target keys were absent before upload.
The uploads are verified by byte count, SHA-256, and HTTP 206 range responses.
Video bytes stay outside Git and the Pages artifact.

| Media key | Bytes | SHA-256 |
| --- | ---: | --- |
| `Kylie/IMG_3186.mov` | 24193907 | `0e38b288fd80886c16234fc8addb2f785ba9e3f2b513071e5dcff13eb42df68a` |
| `Wei/IMG_7856.mov` | 13034451 | `f0aca4d14bbe87c291964184eeca657a692eef70eb1422c6db38bfe31cdbb35a` |
| `Joe/IMG_2650.mov` | 10768986 | `268c9a5d811062e78c757dfc10b315ce18bf5f09d8c7e435486a89cbee24cfd8` |
| `Mino/IMG_5376.mov` | 41674813 | `a3b93799ae39d7e8cb24e3e60abd58909d2a1fa9f6ccae2df0515b328c136cf8` |

## Recorded balances and remaining reconciliation

The ledger contains **160 obligations: 154 completed, 6 recorded as owed**.
It adds four Week 10 score-based obligations and Mino's confirmed November 12
carryover to the prior 155 records. All 151 prior completed rows and keys are
unchanged. The 2026 football season has 57 earned obligations and 8 recorded
carryovers; January archive records belong to the prior season.

The six recorded open obligations are Leah's Week 9 and Week 10 Patriots D/ST,
Marian's Week 9 Ladd McConkey, Will's Week 9 Adonai Mitchell, Mino's Week 10
David Montgomery, and Mino's Week 10 George Pickens carryover.

These balances are not a complete commissioner reconciliation of the
November 12 and 19 cutoffs. Missing recordings for the remaining obligations
could affect additional carryovers. In particular, Mino's two Week 10
obligations need completion evidence or a November 19 carryover assessment.
No extra deadline penalties are inferred from the absence of a new attachment.
Kylie's assignment remains pending. This submission change does not advance
the Current Season snapshot or alter historical matchup data.
