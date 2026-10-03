--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room4z3",
	description = "A 4-door hallway.",
	shape = "4",
	commonness = 100,
	large = false,
	disableDecals = false,
	zones = { 3 },
	asset = "room4z3",
	boundsMin = { -25.6, -0.025, -25.6 },
	boundsMax = { 25.6, 36, 25.6 },
	parts = {
		["2_office_lamps_dif"] = { 0, 9.635, 0, 27.426, 2.672, 27.426 },
		officewall = { 0, 4.8, 0, 51.2, 9.6, 51.2 },
		ceiling = { 0, 10, 0, 51.2, 0.8, 51.2 },
		misc = { 0, 10.749, 0, 51.2, 2.298, 51.2 },
		tilefloor = { 0, -0.013, 0, 51.2, 0.025, 51.2 },
		dirtymetal = { 0, 10.724, 0, 18, 2.348, 18 },
		metal = { 16.6, 1.575, -4.588, 12.95, 3.15, 1.825 },
		metalpanels = { 16.6, 2.401, -4.589, 12.3, 1.303, 1.677 },
		white = { 0, 22.8, 0, 19.2, 26.4, 19.2 },
		glass_alpha = { 0, 15.6, 0, 18.4, 4, 18.4 },
	},
	triggerBoxes = {},
	lights = {
		{
			position = { 0, 11.6, 8.5022 },
			range = 12.5,
			color = { 255, 255, 255 },
			brightness = 1.4,
		},
		{
			position = { -0.0019, 11.6, -8.4984 },
			range = 12.5,
			color = { 255, 255, 255 },
			brightness = 1.4,
		},
	},
	spotlights = {},
	waypoints = {
		{ 8, 2, -0.0063 },
		{ 0, 2, 7.9938 },
		{ -8, 2, 0.0063 },
		{ 0, 2, -7.9938 },
	},
	sounds = {
		{
			position = { 0, 33.2, -0.0063 },
			ambience = 8,
			range = 4,
		},
	},
	screens = {},
	props = {},
	playerStarts = {},
}
