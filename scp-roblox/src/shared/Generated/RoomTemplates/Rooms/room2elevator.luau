--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room2elevator",
	description = "A two-door hallway, with an elevator off to the side.",
	shape = "2",
	commonness = 20,
	large = false,
	disableDecals = false,
	zones = { 1 },
	asset = "room2elevator",
	boundsMin = { -7.6, -0.8, -25.6 },
	boundsMax = { 26.4, 21.3708, 25.6 },
	parts = {
		["2_office_lamps_dif"] = { -0.002, 20.035, -0.003, 1.786, 2.672, 21.032 },
		whitewall = { 1.8, 10, 0, 18.8, 20, 51.2 },
		dirtymetal = { 9.1, 10.011, 0, 33, 20.022, 41.6 },
		white = { 0, 12.4, 0, 15.2, 15.2, 41.6 },
		metalpanels2 = { 1.4, 11.175, 0, 18, 4.85, 50 },
		concretefloor = { 9, 10, 0, 33.2, 20, 51.2 },
		misc = { 9.35, 15.913, -0.012, 19.7, 8.026, 31 },
		metal = { 18.8, 6.4, 0, 15.2, 12.8, 15.2 },
		metal3 = { 18.8, -0.4, 0.2, 15.2, 0.8, 14.8 },
	},
	triggerBoxes = {},
	lights = {
		{
			position = { 0, 19.6739, -15.1142 },
			range = 18.75,
			color = { 255, 255, 255 },
			brightness = 1.4,
		},
		{
			position = { 0, 19.6739, 15.2858 },
			range = 18.75,
			color = { 255, 255, 255 },
			brightness = 1.4,
		},
		{
			position = { 18.8739, 11.7239, 0 },
			range = 15,
			color = { 255, 255, 255 },
			brightness = 1,
		},
	},
	spotlights = {},
	waypoints = {
		{ 0, 1.65, -9.5 },
		{ -0.1, 1.65, 9.5 },
		{ 18.8, 1.65, -0.3 },
	},
	sounds = {},
	screens = {},
	props = {},
	playerStarts = {},
}
