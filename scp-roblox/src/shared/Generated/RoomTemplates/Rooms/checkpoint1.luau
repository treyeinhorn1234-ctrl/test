--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "checkpoint1",
	description = "The keycarded checkpoint between the LCZ and HCZ.",
	shape = "2",
	commonness = 0,
	large = false,
	disableDecals = false,
	zones = {},
	asset = "checkpoint1",
	boundsMin = { -27.6, 0, -25.6 },
	boundsMax = { 27.55, 17.7, 25.6 },
	triggerBoxes = {},
	lights = {
		{
			position = { -0.0261, 17.2739, -6.4 },
			range = 22.5,
			color = { 255, 149, 149 },
			brightness = 1.2,
		},
		{
			position = { -0.0261, 17.2739, 12.8 },
			range = 22.5,
			color = { 255, 149, 149 },
			brightness = 1.2,
		},
	},
	spotlights = {},
	waypoints = {
		{ 1.6, 1.6, -6.4 },
		{ -8, 1.6, -6.4 },
		{ 1.6, 1.6, 14.4 },
		{ -6.4, 1.6, 14.4 },
	},
	sounds = {},
	screens = {},
	props = {
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { 0, 15.5, -12.8 },
			rotation = { -1, 0, 0, 0, 1, 0, 0, 0, -1 },
			scale = { 1, 1, 1 },
		},
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { 0, 15.5, 16 },
			rotation = { -1, 0, 0, 0, 1, 0, 0, 0, -1 },
			scale = { 1, 1, 1 },
		},
		{
			model = "officeseat_a",
			file = "officeseat_a.x",
			position = { 19.112, 0.2, 10.11 },
			rotation = { 0.08716, 0, 0.99619, 0, 1, 0, -0.99619, 0, 0.08716 },
			scale = { 3.5, 3.5, 3.5 },
		},
		{
			model = "officeseat_a",
			file = "officeseat_a.x",
			position = { 22.7105, 0.2, -8.4898 },
			rotation = { -0.08716, 0, 0.99619, 0, 1, 0, -0.99619, 0, -0.08716 },
			scale = { 3.5, 3.5, 3.5 },
		},
	},
	playerStarts = {},
}
