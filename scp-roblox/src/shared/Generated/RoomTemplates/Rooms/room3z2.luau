--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room3z2",
	description = "A T-shaped, three-door hallway.",
	shape = "3",
	commonness = 100,
	large = false,
	disableDecals = false,
	zones = { 2 },
	asset = "room3z2",
	boundsMin = { -25.6, -0.8, -6.4 },
	boundsMax = { 25.6, 10.4, 25.6 },
	parts = {
		metal3 = { 0, -0.4, 9.8, 51.2, 0.8, 31.6 },
		concretewall = { 0, 4.8, 9.6, 51.2, 9.6, 32 },
		concretefloor = { 0, 5.2, 9.4, 51.2, 10.4, 30.8 },
		metalpanels2 = { 0, 4.8, -5.2, 40.8, 7.2, 0.8 },
		misc = { 1.6, 9.5, 4.9, 10.6, 0, 10.4 },
		dirtymetal = { 1.6, 9.548, 4.9, 10.6, 0.096, 10.4 },
	},
	triggerBoxes = {},
	lights = {
		{
			position = { 6.4, 9.2, 0 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1.2,
		},
		{
			position = { -3.2, 9.2, 0 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1.2,
		},
		{
			position = { 0, 9.2, 9.6 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1.2,
		},
	},
	spotlights = {},
	waypoints = {
		{ 0, 0.9, 1.6 },
	},
	sounds = {},
	screens = {},
	props = {
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { -16.4, 8, 0 },
			rotation = { 0, 0, -1, 0, 1, 0, 1, 0, 0 },
			scale = { 1, 1, 1 },
		},
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { 16.4, 8, 0 },
			rotation = { 0, 0, -1, 0, 1, 0, 1, 0, 0 },
			scale = { 1, 1, 1 },
		},
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { 0, 8, 18.2 },
			rotation = { 0, 0, -1, 0, 1, 0, 1, 0, 0 },
			scale = { 1, 1, 1 },
		},
	},
	playerStarts = {},
}
