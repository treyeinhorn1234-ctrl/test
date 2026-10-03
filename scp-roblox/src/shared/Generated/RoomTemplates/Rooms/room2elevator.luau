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
