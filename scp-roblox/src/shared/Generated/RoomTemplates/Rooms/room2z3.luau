--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room2z3",
	description = "An office-styled two-door hallway.",
	shape = "2",
	commonness = 75,
	large = false,
	disableDecals = false,
	zones = { 3 },
	asset = "room2z3",
	boundsMin = { -6.4, -0.025, -25.6 },
	boundsMax = { 6.4, 10.9708, 25.6 },
	parts = {
		["2_office_lamps_dif"] = { 0, 9.635, 0, 1.789, 2.672, 27.426 },
		officewall = { 0, 4.8, 0, 12.8, 9.6, 51.2 },
		ceiling = { 0, 10, 0, 12.8, 0.8, 51.2 },
		misc = { 0, 10, -0.4, 4.2, 0.8, 50.4 },
		tilefloor = { 0, -0.013, 0, 12.8, 0.025, 51.2 },
		metal = { 4.6, 1.575, 18.212, 1.825, 3.15, 12.95 },
		metalpanels = { 4.601, 2.401, 18.212, 1.677, 1.303, 12.3 },
	},
	triggerBoxes = {},
	lights = {},
	spotlights = {},
	waypoints = {
		{ 0, 2, 7.9938 },
		{ 0, 2, -7.9938 },
	},
	sounds = {},
	screens = {},
	props = {},
	playerStarts = {},
}
