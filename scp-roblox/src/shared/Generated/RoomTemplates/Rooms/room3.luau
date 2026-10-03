--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room3",
	description = "Three-door hallway, with a caged off portion in the back wall.",
	shape = "3",
	commonness = 100,
	large = false,
	disableDecals = false,
	zones = { 1 },
	asset = "room3",
	boundsMin = { -25.6, 0, -25.6 },
	boundsMax = { 25.6, 21.3708, 25.6 },
	triggerBoxes = {},
	lights = {
		{
			position = { -15.1142, 19.6739, 0 },
			range = 16.25,
			color = { 255, 255, 255 },
			brightness = 1.4,
		},
		{
			position = { 15.2858, 19.6739, 0 },
			range = 16.25,
			color = { 255, 255, 255 },
			brightness = 1.4,
		},
		{
			position = { -0.012, 19.6739, 15.2023 },
			range = 16.25,
			color = { 255, 255, 255 },
			brightness = 1.4,
		},
		{
			position = { -0.012, 19.6739, -15.1977 },
			range = 16.25,
			color = { 255, 255, 255 },
			brightness = 1.4,
		},
	},
	spotlights = {},
	waypoints = {
		{ -9.5, 1.65, 0 },
		{ 9.5, 1.65, 0.1 },
		{ -0.1, 1.65, 9.7 },
	},
	sounds = {},
	screens = {},
	props = {},
	playerStarts = {},
}
