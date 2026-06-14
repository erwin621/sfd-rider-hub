// ─── CONSTANTS ──────────────────────────────────────────────────────────────

export const CITIES = [
  'Caloocan City','Malabon City','Navotas City','Valenzuela City',
  'Quezon City','Manila City','Pasay City','Parañaque City',
  'Taguig City','Pasig City','Marikina City','Makati City',
  'Las Piñas City','Muntinlupa City','Mandaluyong City','San Juan City','IGOV',
]

export const TECHNICIANS = ['EBANOG','POGI','AZIMUTH_ADMIN','ADMIN']

// ─── VISITS (from DB + MAIN sheets) ────────────────────────────────────────
// Total income = ₱5,500  |  Net = 5500 − CA(2500) − Motor(1000) = ₱2,000

export const MOCK_VISITS = [
  { id:'v1',  visited_by:'EBANOG', visit_date:'2026-06-01', site_code:'L4-012-05FCF', site_name:'Mapulang Lupa Health Center',              locality:'Valenzuela City',  power_check:true,  connectivity_check:true,  hardware_check:true,  cables_check:true,  remarks:'Replaced AP',                     income:500 },
  { id:'v2',  visited_by:'EBANOG', visit_date:'2026-06-01', site_code:'L4-012-04D19', site_name:'Valenzuela National High School',           locality:'Valenzuela City',  power_check:true,  connectivity_check:false, hardware_check:true,  cables_check:true,  remarks:'Blinking LOS',                    income:400 },
  { id:'v3',  visited_by:'EBANOG', visit_date:'2026-06-02', site_code:'L4-003-04D56', site_name:'Manuel L. Quezon High School',              locality:'Caloocan City',    power_check:true,  connectivity_check:true,  hardware_check:true,  cables_check:true,  remarks:'Online no splash page',           income:400 },
  { id:'v4',  visited_by:'EBANOG', visit_date:'2026-06-02', site_code:'L4-003-063C4', site_name:'178-A Health Center',                       locality:'Caloocan City',    power_check:true,  connectivity_check:false, hardware_check:true,  cables_check:true,  remarks:'Blinking LOS',                    income:350 },
  { id:'v5',  visited_by:'EBANOG', visit_date:'2026-06-03', site_code:'L4-003-063CE', site_name:'Barangay 14 Health Center',                 locality:'Caloocan City',    power_check:false, connectivity_check:false, hardware_check:true,  cables_check:true,  remarks:'Defective modem and AP',          income:350 },
  { id:'v6',  visited_by:'EBANOG', visit_date:'2026-06-03', site_code:'L4-003-05F92', site_name:'Sampalukan Health Center',                  locality:'Caloocan City',    power_check:true,  connectivity_check:true,  hardware_check:true,  cables_check:true,  remarks:'Reset Modem',                     income:300 },
  { id:'v7',  visited_by:'EBANOG', visit_date:'2026-06-03', site_code:'L4-003-00795', site_name:'Grace Park Elementary School - Main',       locality:'Caloocan City',    power_check:true,  connectivity_check:true,  hardware_check:true,  cables_check:true,  remarks:'',                                income:250 },
  { id:'v8',  visited_by:'EBANOG', visit_date:'2026-06-03', site_code:'L4-003-05F87', site_name:'Barangay 18 Health Center',                 locality:'Caloocan City',    power_check:true,  connectivity_check:false, hardware_check:true,  cables_check:true,  remarks:'Blinking LOS',                    income:300 },
  { id:'v9',  visited_by:'POGI',   visit_date:'2026-06-04', site_code:'L4-013-05EC1', site_name:'Don Bosco Health Center',                   locality:'Parañaque City',   power_check:true,  connectivity_check:true,  hardware_check:true,  cables_check:true,  remarks:'Reset modem',                     income:350 },
  { id:'v10', visited_by:'POGI',   visit_date:'2026-06-04', site_code:'L4-004-05E99', site_name:'Pulanglupa Dos Health Center',              locality:'Las Piñas City',   power_check:false, connectivity_check:false, hardware_check:false, cables_check:false, remarks:'Site is under construction',      income:300 },
  { id:'v11', visited_by:'EBANOG', visit_date:'2026-06-08', site_code:'L4-007-049E0', site_name:'Tañong Integrated School',                  locality:'Malabon City',     power_check:true,  connectivity_check:true,  hardware_check:true,  cables_check:true,  remarks:'Replaced AP',                     income:125 },
  { id:'v12', visited_by:'EBANOG', visit_date:'2026-06-08', site_code:'L4-012-007FF', site_name:'Punturin Elementary School',                locality:'Valenzuela City',  power_check:true,  connectivity_check:true,  hardware_check:true,  cables_check:true,  remarks:'Reset modem',                     income:125 },
  { id:'v13', visited_by:'EBANOG', visit_date:'2026-06-08', site_code:'L4-012-007F4', site_name:'Canumay East Elementary School',            locality:'Valenzuela City',  power_check:true,  connectivity_check:true,  hardware_check:true,  cables_check:true,  remarks:'Reset modem',                     income:120 },
  { id:'v14', visited_by:'EBANOG', visit_date:'2026-06-08', site_code:'L4-012-05FE0', site_name:'Tugatog Health Center',                     locality:'Valenzuela City',  power_check:true,  connectivity_check:false, hardware_check:true,  cables_check:true,  remarks:'Blinking LOS',                    income:115 },
  { id:'v15', visited_by:'EBANOG', visit_date:'2026-06-08', site_code:'L4-00A-05FAC', site_name:'Bagumbayan Health Center',                  locality:'Navotas City',     power_check:true,  connectivity_check:false, hardware_check:true,  cables_check:true,  remarks:'Defective one access modem',      income:115 },
  { id:'v16', visited_by:'EBANOG', visit_date:'2026-06-09', site_code:'L4-003-05893', site_name:'UCC - Camarin Business Campus',             locality:'Caloocan City',    power_check:true,  connectivity_check:true,  hardware_check:true,  cables_check:true,  remarks:'Reset modem',                     income:150 },
  { id:'v17', visited_by:'POGI',   visit_date:'2026-06-09', site_code:'L4-011-00643', site_name:'San Jose ES - Pag-Ibig sa Nayon Annex',     locality:'Quezon City',      power_check:true,  connectivity_check:true,  hardware_check:true,  cables_check:true,  remarks:'Replaced defective AP',           income:150 },
  { id:'v18', visited_by:'POGI',   visit_date:'2026-06-09', site_code:'L4-011-00644', site_name:'Sinag-Tala Elementary School',              locality:'Quezon City',      power_check:true,  connectivity_check:false, hardware_check:true,  cables_check:true,  remarks:'Blinking LOS',                    income:150 },
  { id:'v19', visited_by:'EBANOG', visit_date:'2026-06-10', site_code:'L4-00B-00686', site_name:"Soldiers' Hills Elementary School",         locality:'Muntinlupa City',  power_check:true,  connectivity_check:false, hardware_check:true,  cables_check:true,  remarks:'AP Defective / Blinking LOS',     income:225 },
  { id:'v20', visited_by:'EBANOG', visit_date:'2026-06-10', site_code:'L4-00B-04CFF', site_name:'Muntinlupa National High School',           locality:'Muntinlupa City',  power_check:true,  connectivity_check:true,  hardware_check:true,  cables_check:true,  remarks:'Replaced AP',                     income:225 },
  { id:'v21', visited_by:'POGI',   visit_date:'2026-06-11', site_code:'L4-011-00626', site_name:'Libis Elementary School',                   locality:'Quezon City',      power_check:true,  connectivity_check:true,  hardware_check:true,  cables_check:true,  remarks:'',                                income:250 },
  { id:'v22', visited_by:'EBANOG', visit_date:'2026-06-11', site_code:'L4-005-05E7A', site_name:'San Miguel Health Center',                  locality:'Manila City',      power_check:true,  connectivity_check:true,  hardware_check:true,  cables_check:true,  remarks:'',                                income:250 },
]
// Income check: 500+400+400+350+350+300+250+300+350+300+125+125+120+115+115+150+150+150+225+225+250+250 = 5500 ✓

// ─── WATCHLIST (from NEW sheet) ────────────────────────────────────────────

export const MOCK_WATCHLIST = [
  { id:'w1',  site_code:'L4-003-007B8', site_name:'Bagong Barrio Elementary School',              locality:'Caloocan City',   issue:'OFFLINE MAY 25',                       date_added:'2026-05-25', resolved:false },
  { id:'w2',  site_code:'L4-003-0017F', site_name:'Pres. Diosdado Macapagal Memorial Medical Center', locality:'Caloocan City', issue:'NO POWER - DEFECTIVE COMMBOX BREAKER',date_added:'2026-05-21', resolved:false },
  { id:'w3',  site_code:'L4-003-05F8B', site_name:'Camarin D Health Center',                       locality:'Caloocan City',   issue:'OFFLINE MAY 12',                       date_added:'2026-05-12', resolved:false },
  { id:'w4',  site_code:'L4-004-05E99', site_name:'Pulanglupa Dos Health Center',                  locality:'Las Piñas City',  issue:'OFFLINE MAY 26',                       date_added:'2026-05-26', resolved:false },
  { id:'w5',  site_code:'L4-008-00010', site_name:'Board of Investments',                          locality:'IGOV',            issue:'OFFLINE MAY 21',                       date_added:'2026-05-21', resolved:false },
  { id:'w6',  site_code:'L4-008-00701', site_name:'Makati Elementary School',                      locality:'Makati City',     issue:'OFFLINE MAY 26',                       date_added:'2026-05-26', resolved:false },
  { id:'w7',  site_code:'L4-007-049E0', site_name:'Tañong Integrated School',                      locality:'Malabon City',    issue:'DEFECTIVE AP',                         date_added:'2026-05-20', resolved:false },
  { id:'w8',  site_code:'L4-005-05E5A', site_name:'M. Earnshaw Health Center',                     locality:'Manila City',     issue:'SITE INSPECTION',                      date_added:'2026-04-23', resolved:false },
  { id:'w9',  site_code:'L4-005-0007D', site_name:'Department of Finance',                         locality:'IGOV',            issue:'DEFECTIVE AP',                         date_added:'2026-05-20', resolved:false },
  { id:'w10', site_code:'L4-005-0008F', site_name:'Bureau of Customs',                             locality:'IGOV',            issue:'OFFLINE MAY 22',                       date_added:'2026-05-22', resolved:false },
  { id:'w11', site_code:'L4-005-04DA8', site_name:'Pres. Sergio Osmena, Sr. High School',          locality:'Manila City',     issue:'DEFECTIVE AP',                         date_added:'2026-05-20', resolved:false },
  { id:'w12', site_code:'L4-005-0006D', site_name:'Intramuros Administration',                     locality:'Manila City',     issue:'OFFLINE MAY 12',                       date_added:'2026-05-12', resolved:false },
  { id:'w13', site_code:'L4-00B-04CFF', site_name:'Muntinlupa National High School',               locality:'Muntinlupa City', issue:'DEFECTIVE AP',                         date_added:'2026-05-20', resolved:false },
  { id:'w14', site_code:'L4-00B-00686', site_name:"Soldiers' Hills Elementary School",             locality:'Muntinlupa City', issue:'DEFECTIVE AP',                         date_added:'2026-05-20', resolved:false },
  { id:'w15', site_code:'L4-013-05ED0', site_name:'Vitalez Health Center',                         locality:'Parañaque City',  issue:'SCHEDULE FOR SITE RELOCATION',         date_added:'2026-05-18', resolved:false },
  { id:'w16', site_code:'L4-013-05EC1', site_name:'Don Bosco Health Center',                       locality:'Parañaque City',  issue:'OFFLINE',                              date_added:'2026-05-25', resolved:false },
  { id:'w17', site_code:'L4-008-06395', site_name:'PNP Aviation Security Group',                   locality:'Pasay City',      issue:'OFFLINE MAY 12',                       date_added:'2026-05-12', resolved:false },
  { id:'w18', site_code:'L4-015-0004B', site_name:'Overseas Workers Welfare Administration',       locality:'Pasay City',      issue:'DEFECTIVE AP - NO AP INSTALLED',       date_added:'2026-05-20', resolved:false },
]

// ─── EXPENSE CONFIG (from MAIN sheet) ─────────────────────────────────────
//  Total Income: ₱5,500  |  Less CA: ₱2,500  |  Motor: ₱1,000  |  Net: ₱2,000
//  Gas Allowance: ₱800  |  Period: Jun 1–15, 2026

export const MOCK_EXPENSES = {
  id:           'exp1',
  period_label: 'Jun 1–15, 2026',
  period_start: '2026-06-01',
  period_end:   '2026-06-15',
  ca_amount:    2500,
  motor_amount: 1000,
  gas_amount:   800,
}

// ─── TECHNICIANS (from UsersDB sheet) ────────────────────────────────────

export const MOCK_TECHNICIANS = [
  { id:'t1', username:'EBANOG',       display_name:'Erwin Anog',    role:'technician', bank:'MARIBANK', contact:'16220905660', active:true },
  { id:'t2', username:'POGI',         display_name:'Technician B',  role:'technician', bank:'',         contact:'',            active:true },
  { id:'t3', username:'AZIMUTH_ADMIN',display_name:'Azimuth Admin', role:'admin',       bank:'',         contact:'',            active:true },
  { id:'t4', username:'ADMIN',        display_name:'System Admin',  role:'admin',       bank:'',         contact:'',            active:true },
]

// ─── SITES (from Master + RAWDATA sheets, 217 total) ─────────────────────

export const MOCK_SITES = [
  // Caloocan City
  { code:'L4-003-04D4A', site_name:'M. B. Asistio Sr. High School Unit',             locality:'Caloocan City', last_visit:'2026-05-26' },
  { code:'L4-003-04A0B', site_name:'Kasarinlan High School',                          locality:'Caloocan City', last_visit:null },
  { code:'L4-003-05F88', site_name:'Barangay 12 Health Center',                       locality:'Caloocan City', last_visit:null },
  { code:'L4-003-04D56', site_name:'Manuel L. Quezon High School',                    locality:'Caloocan City', last_visit:'2026-06-02' },
  { code:'L4-003-04D5C', site_name:'Sampaguita High School',                          locality:'Caloocan City', last_visit:null },
  { code:'L4-003-05893', site_name:'UCC - Camarin Business Campus',                   locality:'Caloocan City', last_visit:'2026-06-09' },
  { code:'L4-003-04D51', site_name:'Caybiga High School',                             locality:'Caloocan City', last_visit:'2026-05-26' },
  { code:'L4-003-063CE', site_name:'Barangay 14 Health Center',                       locality:'Caloocan City', last_visit:'2026-06-03' },
  { code:'L4-003-05F92', site_name:'Sampalukan Health Center',                        locality:'Caloocan City', last_visit:'2026-06-03' },
  { code:'L4-003-007B8', site_name:'Bagong Barrio Elementary School',                 locality:'Caloocan City', last_visit:null },
  { code:'L4-003-0017F', site_name:'Pres. Diosdado Macapagal Memorial Medical Center',locality:'Caloocan City', last_visit:'2026-05-21' },
  { code:'L4-003-063C4', site_name:'178-A Health Center',                             locality:'Caloocan City', last_visit:'2026-06-02' },
  { code:'L4-003-00795', site_name:'Grace Park Elementary School - Main',             locality:'Caloocan City', last_visit:'2026-06-03' },
  { code:'L4-003-05F87', site_name:'Barangay 18 Health Center',                       locality:'Caloocan City', last_visit:'2026-06-03' },
  // IGOV
  { code:'L4-005-00016', site_name:'Bureau of the Treasury',                          locality:'IGOV',          last_visit:'2026-02-17' },
  { code:'L4-008-00010', site_name:'Board of Investments',                            locality:'IGOV',          last_visit:'2025-05-03' },
  { code:'L4-005-0008F', site_name:'Bureau of Customs',                               locality:'IGOV',          last_visit:null },
  { code:'L4-005-00045', site_name:'Philippine Coast Guard',                          locality:'IGOV',          last_visit:null },
  { code:'L4-005-0007D', site_name:'Department of Finance',                           locality:'IGOV',          last_visit:null },
  // Las Piñas City
  { code:'L4-004-0068C', site_name:'Almanza Elementary School - T. S. Cruz Annex',    locality:'Las Piñas City', last_visit:null },
  { code:'L4-004-049F2', site_name:'Las Piñas East National High School',             locality:'Las Piñas City', last_visit:null },
  { code:'L4-004-0069B', site_name:'Pamplona Elementary School - Central',            locality:'Las Piñas City', last_visit:null },
  { code:'L4-004-04D24', site_name:'Las Piñas National High School',                  locality:'Las Piñas City', last_visit:null },
  { code:'L4-004-05E99', site_name:'Pulanglupa Dos Health Center',                    locality:'Las Piñas City', last_visit:'2026-06-04' },
  // Makati City
  { code:'L4-008-006E7', site_name:'Hen. Pio del Pilar Elementary School - Main',     locality:'Makati City',    last_visit:null },
  { code:'L4-008-049FA', site_name:'Bangkal High School',                             locality:'Makati City',    last_visit:null },
  { code:'L4-008-006F2', site_name:'Hen. Pio del Pilar Elementary School I',          locality:'Makati City',    last_visit:null },
  { code:'L4-008-00701', site_name:'Makati Elementary School',                        locality:'Makati City',    last_visit:null },
  // Malabon City
  { code:'L4-007-05875', site_name:'City of Malabon University',                      locality:'Malabon City',   last_visit:null },
  { code:'L4-007-049E0', site_name:'Tañong Integrated School',                        locality:'Malabon City',   last_visit:'2026-06-08' },
  { code:'L4-007-007A7', site_name:'Ninoy Aquino Elementary School',                  locality:'Malabon City',   last_visit:null },
  { code:'L4-007-049E2', site_name:'Catmon Integrated School',                        locality:'Malabon City',   last_visit:null },
  { code:'L4-007-007CF', site_name:'Maysilo Elementary School',                       locality:'Malabon City',   last_visit:null },
  { code:'L4-007-05FAA', site_name:'Tonsuya Health Center',                           locality:'Malabon City',   last_visit:null },
  // Manila City
  { code:'L4-005-04D98', site_name:'Manila Science High School',                      locality:'Manila City',    last_visit:null },
  { code:'L4-005-05E5A', site_name:'M. Earnshaw Health Center',                       locality:'Manila City',    last_visit:'2026-04-23' },
  { code:'L4-005-0006D', site_name:'Intramuros Administration',                       locality:'Manila City',    last_visit:null },
  { code:'L4-005-04DA3', site_name:'Ramon Q. Avancena High School',                   locality:'Manila City',    last_visit:null },
  { code:'L4-005-04D9F', site_name:'Antonio Maceda Integrated School',                locality:'Manila City',    last_visit:null },
  { code:'L4-005-04DA8', site_name:'Pres. Sergio Osmena, Sr. High School',            locality:'Manila City',    last_visit:null },
  { code:'L4-005-05E7A', site_name:'San Miguel Health Center',                        locality:'Manila City',    last_visit:'2026-06-11' },
  { code:'L4-005-00718', site_name:'E. delos Santos Elementary School',               locality:'Manila City',    last_visit:null },
  // Marikina City
  { code:'L4-006-04D3E', site_name:'Parang High School',                              locality:'Marikina City',  last_visit:null },
  { code:'L4-006-0076F', site_name:'Kalumpang Elementary School',                     locality:'Marikina City',  last_visit:null },
  { code:'L4-006-049FD', site_name:'Kalumpang National High School',                  locality:'Marikina City',  last_visit:null },
  { code:'L4-006-05F14', site_name:'Nangka Health Center',                            locality:'Marikina City',  last_visit:null },
  // Muntinlupa City
  { code:'L4-00B-04CFC', site_name:'Muntinlupa Business High School - Main',          locality:'Muntinlupa City',last_visit:null },
  { code:'L4-00B-00686', site_name:"Soldiers' Hills Elementary School",               locality:'Muntinlupa City',last_visit:'2026-06-10' },
  { code:'L4-00B-04CFF', site_name:'Muntinlupa National High School',                 locality:'Muntinlupa City',last_visit:'2026-06-10' },
  // Navotas City
  { code:'L4-00A-04D0D', site_name:'Navotas National High School',                    locality:'Navotas City',   last_visit:null },
  { code:'L4-00A-05FB5', site_name:'Tangos Health Center',                            locality:'Navotas City',   last_visit:null },
  { code:'L4-00A-007A5', site_name:'Bagumbayan Elementary School',                    locality:'Navotas City',   last_visit:null },
  { code:'L4-00A-05FAC', site_name:'Bagumbayan Health Center',                        locality:'Navotas City',   last_visit:'2026-06-08' },
  // Parañaque City
  { code:'L4-013-006B4', site_name:'Sun Valley Elementary School',                    locality:'Parañaque City', last_visit:null },
  { code:'L4-013-05EC1', site_name:'Don Bosco Health Center',                         locality:'Parañaque City', last_visit:'2026-06-04' },
  { code:'L4-013-05ED0', site_name:'Vitalez Health Center',                           locality:'Parañaque City', last_visit:null },
  // Pasay City
  { code:'L4-015-05ED2', site_name:'Dona Marta Health Center',                        locality:'Pasay City',     last_visit:null },
  { code:'L4-022-0644C', site_name:'Philippine Economic Zone Authority',               locality:'Pasay City',     last_visit:null },
  { code:'L4-015-00170', site_name:'Pasay City General Hospital',                     locality:'Pasay City',     last_visit:null },
  { code:'L4-015-0004B', site_name:'Overseas Workers Welfare Administration',         locality:'Pasay City',     last_visit:null },
  { code:'L4-008-06395', site_name:'PNP Aviation Security Group',                     locality:'Pasay City',     last_visit:null },
  // Pasig City
  { code:'L4-009-00731', site_name:'De Castro Elementary School',                     locality:'Pasig City',     last_visit:null },
  { code:'L4-009-00189', site_name:'Rizal Medical Center',                            locality:'Pasig City',     last_visit:null },
  { code:'L4-009-04D2E', site_name:'Sta. Lucia High School',                          locality:'Pasig City',     last_visit:null },
  { code:'L4-009-05F27', site_name:'Kapasigan Health Center',                         locality:'Pasig City',     last_visit:null },
  // Quezon City
  { code:'L4-011-04D79', site_name:'New Era High School',                             locality:'Quezon City',    last_visit:null },
  { code:'L4-011-04D88', site_name:'Pugad Lawin High School',                         locality:'Quezon City',    last_visit:null },
  { code:'L4-011-04D8C', site_name:'Sergio Osmena Sr. High School',                   locality:'Quezon City',    last_visit:null },
  { code:'L4-011-00641', site_name:'Bayanihan Elementary School',                     locality:'Quezon City',    last_visit:null },
  { code:'L4-011-00643', site_name:'San Jose ES - Pag-Ibig sa Nayon Annex',           locality:'Quezon City',    last_visit:'2026-06-09' },
  { code:'L4-011-00644', site_name:'Sinag-Tala Elementary School',                    locality:'Quezon City',    last_visit:'2026-06-09' },
  { code:'L4-011-00626', site_name:'Libis Elementary School',                         locality:'Quezon City',    last_visit:'2026-06-11' },
  { code:'L4-011-05F58', site_name:'Holy Spirit Health Center',                       locality:'Quezon City',    last_visit:'2026-04-17' },
  { code:'L4-011-00109', site_name:'East Avenue Medical Center',                      locality:'Quezon City',    last_visit:null },
  { code:'L4-005-06379', site_name:'Balonbato Barangay Hall',                         locality:'Quezon City',    last_visit:null },
  // San Juan City
  { code:'L4-014-00190', site_name:'San Juan Medical Center',                         locality:'San Juan City',  last_visit:null },
  { code:'L4-014-04D2B', site_name:'San Juan National High School',                   locality:'San Juan City',  last_visit:null },
  { code:'L4-014-063B4', site_name:'Balong Bato Barangay Hall',                       locality:'San Juan City',  last_visit:null },
  // Taguig City
  { code:'L4-022-006B9', site_name:'Ricardo P. Cruz Sr. Elementary School',           locality:'Taguig City',    last_visit:null },
  { code:'L4-022-04D05', site_name:'Gen. Ricardo G. Papa Sr. Memorial HS - Annex',   locality:'Taguig City',    last_visit:null },
  // Valenzuela City
  { code:'L4-012-007FF', site_name:'Punturin Elementary School',                      locality:'Valenzuela City',last_visit:'2026-06-08' },
  { code:'L4-012-007F4', site_name:'Canumay East Elementary School',                  locality:'Valenzuela City',last_visit:'2026-06-08' },
  { code:'L4-012-007EC', site_name:'Isla Elementary School',                          locality:'Valenzuela City',last_visit:null },
  { code:'L4-012-05FCE', site_name:'Manotok Health Center',                           locality:'Valenzuela City',last_visit:null },
  { code:'L4-022-0598B', site_name:'Pamantasan ng Lungsod ng Valenzuela - Annex',     locality:'Valenzuela City',last_visit:null },
  { code:'L4-012-04D1D', site_name:'Dalandanan National High School',                 locality:'Valenzuela City',last_visit:null },
  { code:'L4-012-007FC', site_name:'Wawang Pulo Elementary School',                   locality:'Valenzuela City',last_visit:null },
  { code:'L4-012-05FC6', site_name:'General Tibucio de Leon Health Center II',        locality:'Valenzuela City',last_visit:null },
  { code:'L4-012-007F0', site_name:'A. Deato Elementary School',                      locality:'Valenzuela City',last_visit:null },
  { code:'L4-012-04D16', site_name:'Maysan National High School',                     locality:'Valenzuela City',last_visit:null },
  { code:'L4-012-05FCF', site_name:'Mapulang Lupa Health Center',                     locality:'Valenzuela City',last_visit:'2026-06-01' },
  { code:'L4-012-05FE1', site_name:'Ugong Health Center',                             locality:'Valenzuela City',last_visit:null },
  { code:'L4-012-05FC9', site_name:'Lawang Bato Health Center',                       locality:'Valenzuela City',last_visit:null },
  { code:'L4-012-05FD2', site_name:'Maysan Health Center',                            locality:'Valenzuela City',last_visit:null },
  { code:'L4-012-05FE0', site_name:'Tugatog Health Center',                           locality:'Valenzuela City',last_visit:'2026-06-08' },
  { code:'L4-012-04D19', site_name:'Valenzuela National High School',                 locality:'Valenzuela City',last_visit:'2026-06-01' },
  // Mandaluyong City
  { code:'L4-002-063A5', site_name:'Poblacion Health Center',                         locality:'Mandaluyong City',last_visit:null },
]
