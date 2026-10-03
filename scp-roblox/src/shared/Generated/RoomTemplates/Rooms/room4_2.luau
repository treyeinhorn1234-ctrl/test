--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room4_2",
	description = "A varient of the four-door hallway, without the metal walkway.",
	shape = "4",
	commonness = 80,
	large = false,
	disableDecals = false,
	zones = { 1 },
	asset = "room4_2",
	boundsMin = { -25.6, 0, -25.6 },
	boundsMax = { 25.6, 19.6213, 25.6 },
	parts = {
		["2_office_lamps_dif"] = { -0.001, 17.956, 0.001, 21.06, 3.331, 21.06 },
		whitewall = { 0, 8.8, 0, 51.2, 17.6, 51.2 },
		dirtymetal = { 0, 15.911, 0, 41.6, 3.422, 41.6 },
		metalpanels2 = { 0, 11.175, 0, 50, 4.85, 50 },
		white = { 0, 10.8, -0.001, 41.6, 13.6, 41.6 },
		concretefloor = { 0, 8.8, 0, 51.2, 17.6, 51.2 },
		misc = { 0, 17.526, -0.012, 31, 0, 31 },
	},
	triggerBoxes = {},
	lights = {
		{
			position = { 0, 17.2739, -15.1142 },
			range = 16.25,
			color = { 255, 255, 255 },
			brightness = 1.4,
		},
		{
			position = { 0, 17.2739, 15.2858 },
			range = 16.25,
			color = { 255, 255, 255 },
			brightness = 1.4,
		},
		{
			position = { -15.2023, 17.2739, -0.012 },
			range = 16.25,
			color = { 255, 255, 255 },
			brightness = 1.4,
		},
		{
			position = { 15.1977, 17.2739, -0.012 },
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
