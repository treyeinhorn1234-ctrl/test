--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "checkpoint2",
	description = "The keycarded checkpoint which leads from the HCZ to the EZ.",
	shape = "2",
	commonness = 0,
	large = false,
	disableDecals = false,
	zones = {},
	asset = "checkpoint2",
	boundsMin = { -27.55, 0, -25.65 },
	boundsMax = { 27.6, 17.7, 25.6 },
	triggerBoxes = {},
	lights = {
		{
			position = { 0.0261, 17.2739, 6.4 },
			range = 22.5,
			color = { 255, 149, 149 },
			brightness = 1.2,
		},
		{
			position = { 0.0261, 17.2739, -12.8 },
			range = 22.5,
			color = { 255, 149, 149 },
			brightness = 1.2,
		},
	},
	spotlights = {},
	waypoints = {
		{ 8.4, 1.6, -12 },
		{ -1.2, 1.6, -12 },
		{ 8.4, 1.6, 6.4 },
		{ -1.2, 1.6, 6.4 },
	},
	sounds = {},
	screens = {},
	props = {
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { 0, 15.5, 12.8 },
			rotation = { 1, 0, 0, 0, 1, 0, 0, 0, 1 },
			scale = { 1, 1, 1 },
		},
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { 0, 15.5, -16 },
			rotation = { 1, 0, 0, 0, 1, 0, 0, 0, 1 },
			scale = { 1, 1, 1 },
		},
		{
			model = "officeseat_a",
			file = "officeseat_a.x",
			position = { -19.112, 0.2, -10.11 },
			rotation = { -0.08716, 0, -0.99619, 0, 1, 0, 0.99619, 0, -0.08716 },
			scale = { 3.5, 3.5, 3.5 },
		},
		{
			model = "officeseat_a",
			file = "officeseat_a.x",
			position = { -22.7105, 0.2, 8.4898 },
			rotation = { 0.08716, 0, -0.99619, 0, 1, 0, 0.99619, 0, 0.08716 },
			scale = { 3.5, 3.5, 3.5 },
		},
	},
	playerStarts = {},
}
