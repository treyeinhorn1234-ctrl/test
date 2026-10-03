--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room4",
	description = "A four-door hallway, with a metal walkway hanging above.",
	shape = "4",
	commonness = 100,
	large = false,
	disableDecals = false,
	zones = { 1 },
	asset = "room4",
	boundsMin = { -25.6, 0, -25.6 },
	boundsMax = { 25.6, 21.2614, 25.6 },
	parts = {
		["2_office_lamps_dif"] = { -0.004, 19.98, 0.004, 20.631, 2.562, 20.631 },
		whitewall = { 0, 10, 0, 51.2, 20, 51.2 },
		dirtymetal = { 0, 14.911, 0, 41.6, 10.222, 41.6 },
		white = { 0, 12.4, 0, 41.6, 15.2, 41.6 },
		metalpanels2 = { 0, 11.175, 0, 50, 4.85, 50 },
		concretefloor = { 0, 10, 0, 51.2, 20, 51.2 },
		metal3 = { 9.2, 10.2, -0.8, 4.8, 0.4, 32 },
		door01 = { 9.197, 14.4, 0, 4.794, 8, 25.6 },
		misc = { 0, 19.926, -0.012, 31, 0, 31 },
	},
	triggerBoxes = {},
	lights = {
		{
			position = { 0, 19.6739, -15.1142 },
			range = 16.25,
			color = { 255, 255, 255 },
			brightness = 1.4,
		},
		{
			position = { 0, 19.6739, 15.2858 },
			range = 16.25,
			color = { 255, 255, 255 },
			brightness = 1.4,
		},
		{
			position = { -15.2023, 19.6739, -0.012 },
			range = 16.25,
			color = { 255, 255, 255 },
			brightness = 1.4,
		},
		{
			position = { 15.1977, 19.6739, -0.012 },
			range = 16.25,
			color = { 255, 255, 255 },
			brightness = 1.4,
		},
	},
	spotlights = {},
	waypoints = {
		{ 0, 1.65, 0.1 },
		{ -0.1, 1.65, 0 },
	},
	sounds = {},
	screens = {},
	props = {},
	playerStarts = {},
}
