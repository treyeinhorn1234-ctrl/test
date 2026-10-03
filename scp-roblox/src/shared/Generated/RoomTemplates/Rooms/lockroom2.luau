--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "lockroom2",
	description = "The open-doored lockroom, with SCP-096 sitting in the middle.",
	shape = "2C",
	commonness = 0,
	large = false,
	disableDecals = false,
	zones = { 3 },
	asset = "lockroom2",
	boundsMin = { -21.6, -0.025, -21.6 },
	boundsMax = { 25.6, 10.8708, 25.6 },
	triggerBoxes = {},
	lights = {
		{
			position = { -6.4, 9.2, -6.4 },
			range = 12.5,
			color = { 255, 50, 50 },
			brightness = 1,
		},
		{
			position = { 9.6, 9.2, -6.4 },
			range = 12.5,
			color = { 255, 50, 50 },
			brightness = 1,
		},
		{
			position = { -6.4, 9.2, 9.6 },
			range = 12.5,
			color = { 255, 50, 50 },
			brightness = 1,
		},
		{
			position = { 9.6, 9.2, 9.6 },
			range = 12.5,
			color = { 255, 50, 50 },
			brightness = 1,
		},
		{
			position = { 20.8, 9.2, 0 },
			range = 12.5,
			color = { 255, 255, 255 },
			brightness = 1,
		},
		{
			position = { -0.0239, 9.2, 20.0239 },
			range = 12.5,
			color = { 255, 255, 255 },
			brightness = 1,
		},
	},
	spotlights = {},
	waypoints = {
		{ 20.7, 0.8, -5.575 },
		{ 20.7, 0.8, -18.375 },
		{ 9.5, 0.8, -15.975 },
		{ -16.9, 0.8, 9.625 },
		{ -13.7, 0.8, 20.5125 },
		{ -5.7, 0.8, 20.825 },
		{ 10.3, 0.8, 10.025 },
		{ -3.3, 0.8, -3.175 },
	},
	sounds = {},
	screens = {},
	props = {},
	playerStarts = {},
}
